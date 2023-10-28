import {Command} from 'commander';
import package_json from './package.json' assert {type: "json"}
import {join_mkdir, join_mkfile, question, qw, read_json, Settings, setup_log} from "oshi_utils";
import perform_scape from './scrape.js';
import * as ai from "./ai_integration.js";
import path from "path";
import fs from "fs";
import os from "os";
import {get_database, update_vacancy} from "./utils.js";

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

program
    .command('config')
    .description('Reconfigurate your job_search app')
    .option('--encrypt', 'Encrypt your data with password?')
    .action(async args => {
        let store_pass = args.encrypt ? await question('Enter encrypt password', 'password') : null;
        let settings = new Settings(settings_path, store_pass);
        let obj = (await settings.read()) || {linkedin: {}};
        obj.linkedin.login = await question('Enter your LinkedIn email login', 'mail',
            {def: obj.linkedin.login});
        obj.linkedin.pass = await question('Enter your LinkedIn pass', 'password',
            {def: obj.linkedin.pass});
        obj.linkedin.searches = await question('Enter desired job searches splitted by new line. Double Enter to finish',
            'plain_list', {def: obj.linkedin.searches});

        console.log('You need to select your plain text resume. If you have PDF resume format, visit https://pdf2md.morethan.io/' +
            'where you can convert PDF->plain text. Save plain text to file and select it');
        obj.linkedin.plain_text_resume = await question('Select plain text resume file', 'existing_filepath',
            {def: obj.linkedin.plain_text_resume});

        settings.save(obj);
        console.log('DONE');
    });

async function scrape(args) {
    let settings = new Settings(settings_path, args.encrypt);
    let {linkedin} = (await settings.read()) || {};
    if (qw`login pass searches`.some(x => !linkedin?.[x]))
        return console.error('Use "config" before');
    await perform_scape(linkedin);
    console.log('DONE');
}

program
    .command('scrape')
    .description('Searching for best jobs suitable for you')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(scrape);

async function analyze(args) {
    await ai.init();
    let settings = new Settings(settings_path, args.encrypt);
    let {linkedin} = (await settings.read()) || {};
    if (qw`plain_text_resume`.some(x => !linkedin?.[x]))
        return console.error('Use "config" before');
    let resume_txt = fs.readFileSync(linkedin.plain_text_resume, 'utf-8');
    let db = await get_database();
    /**@type {Vacancy[]}*/
    let vacancies = await db.findAsync({ai_resp: {$exists: false}});
    for (let vacancy of vacancies.filter(x => !x.ai_resp)) {
        let {text, job_id} = vacancy;
        let prompt = 'Your role is HR. You need to read given resume and job vacancy and return me ' +
            'percentage of how this job is suitable for both job seeker and recruiter. Your answer should be ' +
            '0-100% only on first raw, next lines should contains procs/cons for such vacancy.';
        let all_prompt = [prompt, text, resume_txt].join('\n\n');
        let resp = await ai.ask(all_prompt);
        let result = /\d+%/g.exec(resp)?.[0]?.replace('%', '')?.trim();
        let percentage = +result || 0;
        await update_vacancy(db, {job_id: +job_id, ai_resp: resp, percentage});
    }
}

program.command('analyze')
    .description('Analyze jobs with AI')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(analyze);

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