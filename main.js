import {Command} from 'commander';
import package_json from './package.json' assert {type: "json"}
import {join_mkfile, question, qw, Settings} from "oshi_utils";
import perform_scape from './scrape.js';
import {ask} from "./ai_integration.js";
import path from "path";
import fs from "fs";
import os from "os";

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

program
    .command('scrape')
    .description('Searching for best jobs suitable for you')
    .option('--encrypt=STR', 'Your encrypt password')
    .action(async args => {
        let settings = new Settings(settings_path, args.encrypt);
        let {linkedin} = (await settings.read()) || {};
        if (qw`login pass searches plain_text_resume`.some(x=>!linkedin?.[x]))
            return console.error('Use "config" before');
        let resume_txt = fs.readFileSync(linkedin.plain_text_resume, 'utf-8');

            /**
             * @param vacancy {Vacancy}
             * @param save_changed_cb {(Vacancy)=>void}
             * @returns {Promise<void>}
             */
        async function on_vacancy_founded(vacancy, save_changed_cb) {
            let prompts = ['Your role is HR. You need to read given resume and job vacancy and return me ' +
            'percentage of how this job is suitable for both job seeker and recruiter. Your answer should be 0-100%.',
                    resume_txt,
                    vacancy.text,
            ];
            vacancy.ai_resp = await ask(prompts);
            save_changed_cb(vacancy);
        }
        let vacancies = await perform_scape(linkedin, {on_vacancy_founded});
        console.log('Founded', vacancies.length, 'vacancies total');
    });


program.parse();