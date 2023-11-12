import os from "os";
import path from "path";
import fs from "fs";
import {Command} from 'commander';
import package_json from './package.json' assert {type: "json"}
import {exec, join_mkdir, join_mkfile, question, qw, read_json, Settings, setup_log, date} from "oshi_utils";
import express from "express";

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
    .name('start')
    .description('Run main server')
    .action(async () => {
        const app = express();
        app.use(express.json());
        app.use(express.text());
        app.use(express.static(path.resolve('frontend'))); // HTML files

        let dir = path.resolve('backend');
        let backends = fs.readdirSync(dir).filter(x=>x.includes('server') && x.endsWith('.js')).map(x=>path.join(dir, x));
        let res = await Promise.all(backends.map(x=>import('file://'+x.toString())));
        res.filter(x=>x.install).map(x=>x.install(app));

        dir = path.resolve('workers');
        backends = fs.readdirSync(dir).filter(x=>x.includes('worker') && x.endsWith('.js')).map(x=>path.join(dir, x));
        res = await Promise.all(backends.map(x=>import('file://'+x.toString())));
        res.filter(x=>x.run).map(x=>x.run());

        let port = 6793;
        app.listen(port, (err) => {
            let url = 'http://localhost:' + port;
            // exec(`start "${url}"`);
        });
    });
//
// async function config(args) {
//     let store_pass = args.encrypt ? await question('Enter encrypt password', 'password') : null;
//     let settings = new Settings(settings_path, store_pass);
//     /** @type {JobSearchSettings}*/
//     let obj = (await settings.read()) || {};
//
//     obj.login = await question('Enter your LinkedIn email login', 'mail', {def: obj.login});
//     obj.pass = await question('Enter your LinkedIn email login', 'password', {def: obj.pass});
//     obj.searches = await question('Enter desired job searches splitted by new line. Double Enter to finish',
//         'plain_list', {def: obj.searches});
//     obj.location = await question('Enter desired job location', 'string',
//         {def: obj.location || 'worldwide'});
//     obj.prompt = await question('Enter additional prompt for helping AI range vacancies. Use main idea - to lower ' +
//         'percentage if something doesn\'t suit you.\nExample:\nPrefer on site vacancies. Give preference to vacancies ' +
//         'with a specified salary.', 'string', {def: obj.prompt});
//     obj.apply_threshold = await question('Enter desired vacancy compatibility apply. AI returns vacancy rating, ' +
//         'which will be comparing with this value', 'custom', {
//         def: obj.apply_threshold || 90,
//         cb: str => {
//             let num = +str;
//             if (Number.isInteger(num) && 0 <= num && num <= 100)
//                 return {val: num};
//             return {err: new Error('Provide value from 0 to 100')};
//         }
//     });
//     obj.phone = obj.phone || {};
//     obj.phone.code = await question('[LinkedIn easy apply] Enter your phone code\nExamples: US: +1, Germany: +49', 'string',
//         {def: obj.phone?.code});
//     obj.phone.number = await question('[LinkedIn easy apply] Enter rest of your phone number', 'int',
//         {def: obj.phone?.number});
//
//     settings.save(obj);
//     console.log('DONE');
// }
//
// program
//     .command('config')
//     .description('Reconfigurate your job_search app')
//     .option('--encrypt', 'Encrypt your data with password?')
//     .action(config);
//
// async function scrape(args) {
//     let settings = new Settings(settings_path, args.encrypt);
//     let cfg = (await settings.read()) || {};
//     if (qw`login pass searches`.some(x => !cfg?.[x]))
//         return console.error('Use "config" before');
//     await update_vacancies(cfg);
//     await perform_scrape(cfg);
//     console.log('DONE');
// }
//
// program
//     .command('scrape')
//     .description('Searching for best jobs suitable for you')
//     .option('--encrypt=STR', 'Your encrypt password')
//     .action(scrape);
//
// async function analyze(arg) {
//     await ai.init();
//     let settings = new Settings(settings_path, arg.encrypt);
//     /** @type {JobSearchSettings}*/
//     let cfg = (await settings.read()) || {};
//     await update_vacancies(cfg);
//
//     let resume_txt = fs.readFileSync(path.resolve(await build_resume(), '..', 'resume.txt'), 'utf-8');
//     let db = await get_vacancy_db();
//
//     /**@type {Vacancy[]}*/
//     let vacancies = await db.findAsync({ai_resp: {$exists: false}});
//     for (let vacancy of vacancies.filter(x => !x.ai_resp)) {
//         let {text, job_id} = vacancy;
//         let prompt = 'Your role is HR helper. You will need to read resume and vacancy text below and ' +
//             'find out how this job is suitable for both job seeker and recruiter. Your response must contain ' +
//             'compatibility percentage (0-100%), newline, provide desired vacancy stack I have (list with bullets), ' +
//             'newline, vacancy stack I do not have (list with bullets), newline, salary is mentioned, newline, ' +
//             'can job provide work/visa/relocation if mentioned, newline, job location if mentioned, newline, ' +
//             'company name and what is it doing (very shortly), newline, what should I do at this role (shortly). '
//             + cfg?.prompt;
//         let all_prompt = [prompt, text, resume_txt].join('\n\n');
//         let resp = await ai.ask(all_prompt);
//         let percentage = +/\d+%/g.exec(resp)?.[0]?.replace('%', '')?.trim() || 0;
//         if (percentage > 0)
//             await build_resume(percentage); // create resume to send
//         await update_one(db, {job_id: +job_id}, {ai_resp: resp, percentage, prompt});
//     }
// }
//
// program.command('analyze')
//     .description('Analyze jobs with AI')
//     .option('--encrypt=STR', 'Your encrypt password')
//     .action(analyze);
//
// async function run_report_srv(arg){
//     let url = await serve();
//     console.debug('Report server was started');
//     let settings = new Settings(settings_path, arg.encrypt);
//     /** @type {JobSearchSettings}*/
//     let cfg = (await settings.read()) || {};
//     // update_vacancies(cfg);
//     exec(`start "${url}"`);
// }
//
// program.command('report')
//     .description('Open report server')
//     .option('--encrypt=STR', 'Your encrypt password')
//     .action(run_report_srv);
//
// program.command('scape-and-analyze')
//     .description('Command will scrape jobs for you and arrange it with AI')
//     .option('--encrypt=STR', 'Your encrypt password')
//     .action(async args => {
//         let fns = [scrape, analyze];
//         for (let fn of fns) {
//             try {
//                 await fn(args);
//             } catch (e) {
//                 console.debug('Some error during execution:', e);
//             }
//         }
//     })


program.parse();