import {get_jobs_db, get_vacancy_db, handler,} from "../utils.js";
import {read_settings, use_vacancy_mw} from "./utils.js";
import {build_resume} from "../resume_bulider.js";
import {convert} from 'html-to-text'
import path from "path";
import fs from "fs";

export async function analyze(vacancy){
    let job_db = await get_jobs_db();
    let count = await job_db.countAsync({
        job_id: +vacancy.job_id,
        type: 'ai',
        end: {$exists: false},
    });
    if (count == 0)
    {
        let cfg = await read_settings();
        let prompt = 'Your role is HR helper. You will need to read resume and vacancy text below and ' +
            'find out how this job is suitable for both job seeker and recruiter. Your response must contain ' +
            'compatibility percentage (0-100%), newline, provide desired vacancy stack I have (list with bullets), ' +
            'newline, vacancy stack I do not have (list with bullets), newline, salary is mentioned, newline, ' +
            'can job provide work/visa/relocation if mentioned, newline, job location if mentioned, newline, ' +
            'company name and what is it doing (very shortly), newline, what should I do at this role (shortly). '
            + cfg?.prompt;
        let resume_txt = fs.readFileSync(path.resolve(await build_resume(), '..', 'resume.txt'), 'utf-8');
        let vacancy_text = convert(vacancy.html_content).replace(/\n\n+/g, '\n');
        let question = [prompt, resume_txt, vacancy_text].join('\n\n');

        await job_db.insertAsync({
            job_id: +vacancy.job_id,
            created: new Date(),
            question,
            type: 'ai',
        });
    }
    return true;
}

/**
 * @param app {Express}
 */
export function install(app) {
    app.patch('/vacancy', handler(async (req, res) => {
        let upd = JSON.parse(req.body);
        let job_id = +upd.job_id;
        if (!Number.isInteger(job_id))
            throw Object.assign(new Error('No job ID provided'), {code: 400});
        let changed_keys = `percentage ai_resp applied_time`.split(' ');
        let q = {$set: {}, $unset: {}};
        for (let src of [upd, upd.$set].filter(Boolean)) {
            for (let key of changed_keys.filter(x => src.hasOwnProperty(x)))
                q.$set[key] = src[key];
        }
        for (let src of [upd.$unset].filter(Boolean)) {
            for (let key of changed_keys.filter(x => src.hasOwnProperty(x)))
                q.$unset[key] = src[key];
        }
        if (!Object.keys(q.$set).length && !Object.keys(q.$unset).length)
            throw Object.assign(new Error('Check supported props to change: ' + changed_keys.join(', ')), {code: 400});
        q.$set.last_touch = new Date();
        let db = await get_vacancy_db();
        await db.update({job_id}, q);
        return true;
    }));
    app.get('/vacancies', handler(async req => {
        let db = await get_vacancy_db();
        let skip = +req.query.skip || 0;
        let limit = +req.query.limit || 10;
        let find = JSON.parse(req.query.find) || {};
        let sort = JSON.parse(req.query.sort) || {};
        let q = {};

        function split_keys(str) {
            return str.split(' ').filter(x => find.hasOwnProperty(x));
        }

        let exact_keys = split_keys('easy_apply');
        let numeric_regex_keys = split_keys('job_id');
        let numeric_exact_keys = split_keys('percentage applies');
        let date_exact_keys = split_keys('applied_time');
        let text_regex_keys = split_keys('location');

        for (let key of exact_keys)
            q[key] = find[key];
        for (let key of numeric_exact_keys)
            q[key] = +find[key];
        for (let key of text_regex_keys)
            q[key] = {$regex: new RegExp(find[key], 'gi')};
        for (let key of date_exact_keys) {
            let src = find[key];
            if (typeof src == 'string' || typeof src == 'number')
                src = new Date(src);
            q[key] = src;
        }
        if (numeric_regex_keys.length) {
            q.$where = function () {
                for (let key of numeric_regex_keys) {
                    if (!this.hasOwnProperty(key))
                        continue;

                    let regex = new RegExp(find[key], 'gi');
                    let src = this[key] + '';
                    if (regex.test(src))
                        return true;
                }
                return false;
            };
        }

        // special cases
        if (find.company_name) {
            let $regex = new RegExp(find.company_name, 'gi');
            q.$or = [
                {company_name: {$regex}},
                {text: {$regex}},
                {ai_resp: {$regex}},
            ];
        }
        if (find.applied_time == 'any')
            q.applied_time = {$exists: true, $gt: new Date(0)};
        if (find.percentage == '-')
            q.percentage = {$exists: false};

        for (let key of Object.keys(sort))
            sort[key] = sort[key] == 'asc' ? 1 : -1;

        let items = await db.find(q).sort(sort).skip(skip).limit(limit);
        let count = await db.count(q);
        let result = {items, count, status: {}};

        let job_ids = items.map(x=>x.job_id);
        let job_db = await get_jobs_db();
        /** @type {Job[]}*/
        let in_process = await job_db.findAsync({
            job_id: {$in: job_ids},
            end: {$exists: false},
        }).projection({job_id: 1, type: 1});

        for (let job of in_process) {
            result.status[job.job_id] = job.type;
        }

        return result;
    }));
    app.post('/vacancy', handler(async req => {
        let upd = JSON.parse(req.body);
        let job_id = +upd.job_id;
        if (!Number.isInteger(job_id))
            throw Object.assign(new Error('No job ID provided'), {code: 400});
        let db = await get_vacancy_db();
        if (await db.countAsync({job_id}) == 0)
        {
            let insert = `job_id link applied_time`.split(' ').filter(x => upd.hasOwnProperty(x))
                .reduce((prev, key) => Object.assign(prev, {[key]: upd[key]}), {});
            insert.last_touch = new Date();
            insert.insert_time = new Date();
            await db.insertAsync(insert);
        }
        const job_db = await get_jobs_db();
        await job_db.insert({
            job_id,
            type: 'scrape',
            created: new Date(),
        });
        return true;
    }));
    app.post('/analyze', use_vacancy_mw, handler(async req => {
        await analyze(req.vacancy);
        return true;
    }));
}