import {Command} from 'commander';
import package_json from './package.json' assert {type: "json"}
import {exec, join_mkdir, join_mkfile, question, qw, read_json, Settings, setup_log} from "oshi_utils";
import perform_scape from './scrape.js';
import perform_apply from './apply.js';
import * as ai from "./ai_integration.js";
import path from "path";
import fs from "fs";
import os from "os";
import {get_vacancy_db, update_one} from "./utils.js";
import {build_resume} from './resume_bulider.js';

setup_log({
    log_dir: join_mkdir(os.homedir(), 'job_search', 'logs'),
})

const {name, description, version} = package_json;

const program = new Command();

export const settings_path = join_mkfile(os.homedir(), 'job_search', 'settings.json');

program
    .name(name)
    .description(description)
    .version(version);

async function config(args) {
    let store_pass = args.encrypt ? await question('Enter encrypt password', 'password') : null;
    let settings = new Settings(settings_path, store_pass);
    /** @type {JobSearchSettings}*/
    let obj = (await settings.read()) || {};

    obj.login = await question('Enter your LinkedIn email login', 'mail', {def: obj.login});
    obj.pass = await question('Enter your LinkedIn email login', 'password', {def: obj.pass});
    obj.searches = await question('Enter desired job searches splitted by new line. Double Enter to finish',
        'plain_list', {def: obj.searches});
    obj.location = await question('Enter desired job location', 'string',
        {def: obj.location || 'worldwide'});
    obj.prompt = await question('Enter additional prompt for helping AI range vacancies. Use main idea - to lower ' +
        'percentage if something doesn\'t suit you.\nExample:\nPrefer on site vacancies. Give preference to vacancies ' +
        'with a specified salary.', 'string', {def: obj.prompt});
    obj.apply_threshold = await question('Enter desired vacancy compatibility apply. AI returns vacancy rating, ' +
        'which will be comparing with this value', 'custom', {
        def: obj.apply_threshold || 90,
        cb: str => {
            let num = +str;
            if (Number.isInteger(num) && 0 <= num && num <= 100)
                return {val: num};
            return {err: new Error('Provide value from 0 to 100')};
        }
    });
    obj.phone = obj.phone || {};
    obj.phone.code = await question('[LinkedIn easy apply] Enter your phone code\nExamples: US: +1, Germany: +49', 'string',
        {def: obj.phone?.code});
    obj.phone.number = await question('[LinkedIn easy apply] Enter rest of your phone number', 'int',
        {def: obj.phone?.number});

    settings.save(obj);
    console.log('DONE');
}

program
    .command('config')
    .description('Reconfigurate your job_search app')
    .option('--encrypt', 'Encrypt your data with password?')
    .action(config);

async function scrape(args) {
    let settings = new Settings(settings_path, args.encrypt);
    let cfg = (await settings.read()) || {};
    if (qw`login pass searches`.some(x => !cfg?.[x]))
        return console.error('Use "config" before');
    await perform_scape(cfg);
    console.log('DONE');
}

program
    .command('scrape')
    .description('Searching for best jobs suitable for you')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(scrape);

async function analyze(arg) {
    await ai.init();
    let settings = new Settings(settings_path, arg.encrypt);
    /** @type {JobSearchSettings}*/
    let cfg = (await settings.read()) || {};
    let resume_txt = fs.readFileSync(path.resolve(await build_resume(), '..', 'resume.txt'), 'utf-8');
    let db = await get_vacancy_db();
    /**@type {Vacancy[]}*/
    let vacancies = await db.findAsync({ai_resp: {$exists: false}});
    for (let vacancy of vacancies.filter(x => !x.ai_resp)) {
        let {text, job_id} = vacancy;
        let prompt = 'Your role is HR helper. You will need to read resume and vacancy text below and ' +
            'find out how thi job is sutiable for both job seeker and recruiter. Your response must contain ' +
            'compatibility percentage (0-100%) then briefly provide vacancy procs/cons.' + cfg?.prompt;
        let all_prompt = [prompt, text, resume_txt].join('\n\n');
        let resp = await ai.ask(all_prompt);
        let percentage = +/\d+%/g.exec(resp)?.[0]?.replace('%', '')?.trim() || 0;
        if (percentage > 0)
            await build_resume(percentage); // create resume to send
        await update_one(db, {job_id: +job_id}, {ai_resp: resp, percentage, prompt});
    }
}

program.command('analyze')
    .description('Analyze jobs with AI')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(analyze);

async function apply(arg) {
    let settings = new Settings(settings_path, arg.encrypt);
    /** @type {JobSearchSettings}*/
    let cfg = (await settings.read()) || {};
    if (qw`apply_threshold`.some(x => !cfg[x]))
        return console.error('use config command');
    let {phone} = cfg;
    if (qw`code number`.some(x=>!phone[x]))
        return console.error('use config command');

    await perform_apply(cfg);
}

program.command('apply')
    .description('Auto apply on best jobs for you')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(apply);

async function create_report(){
    let db = await get_vacancy_db();
    /** @type {Vacancy[]}*/
    let vacancies = await db.find({});
    console.debug('Total', vacancies.length, 'vacancies');
    const table_def = [
        {
            header: 'Job ID',
            value: x=>x.job_id,
        },
        {
            header: 'Link',
            value: x=>`<a data-tippy="${x.text}" href="${x.link}">${x.job_id}</a>`,
        },
        {
            header: 'Location',
            value: x=>`<a href="${''}">${x.location}</a>`,
        },
        {
            header: 'Compatibility',
            value: x=>Number.isInteger(x.percentage) ? x.percentage+'%' : '-',
        },
        {
            header: 'Easy apply',
            value: x=>x.easy_apply ? 'yes' : 'no',
        },
        {
            header: 'Create date',
            value: x=>new Date(x.vacancy_time).toDateString(),
        },
        {
            header: 'Applies',
            value: x=>x.applies,
        },
        {
            header: 'Applied',
            value: x=>x.applied_time ? new Date(x.applied_time).toDateString() : '-',
        },
    ];
    let HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/mobius1/vanilla-Datatables@latest/vanilla-dataTables.min.css">
    <script type="text/javascript" src="https://cdn.jsdelivr.net/gh/mobius1/vanilla-Datatables@latest/vanilla-dataTables.min.js"></script>    
    <script>
        function setup_table() {
            // setup table
            new DataTable("#table", {
                searchable: true,           
                perPage: 25,     
            });  
        }          
    </script>
</head>
<body onload="setup_table()">
    <table id="table">
        <thead>
            <tr>
                ${table_def.map(x => x.header).map(x => `<td>${(x)}</td>`).join('\n')}       
            </tr>    
        </thead>    
        <tbody>
            ${vacancies.map(data=>{
                let cells = table_def.map(x=>`<td>${(x.value(data))}</td>`).join('\n');
                return `<tr>
                    ${cells}
                </tr>`;
            }).join('\n')}                    
        </tbody>
    </table>
    
    <script src="https://unpkg.com/tippy.js@3/dist/tippy.all.min.js"></script>
</body>
`;
    let dir = join_mkdir(os.homedir(), 'job_search', 'report');
    let report_file = path.join(dir, 'report.html');
    fs.writeFileSync(report_file, HTML, 'utf-8');

    exec(`open "${report_file}"`);
    console.debug('DONE');
}

program.command('report')
    .description('Create HTML report from scrape/apply history')
    .action(create_report);

program.command('scape-and-analyze')
    .description('Command will scrape jobs for you and arrange it with AI')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(async args => {
        let fns = [scrape, analyze];
        for (let fn of fns) {
            try {
                await fn(args);
            } catch (e) {
                console.debug('Some error during execution:', e);
            }
        }
    })


program.parse();