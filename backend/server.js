import express from 'express';
import path from "path";
import {get_vacancy_db, handler, update_one,} from "../utils.js";
import {qw} from "oshi_utils";

const app = express();

app.use(express.json());
app.use(express.text());
app.use(express.static(path.resolve('frontend'))); // HTML files

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
    return {items, count};
}));
app.post('/vacancy', handler(async req=>{
    let upd = JSON.parse(req.body);
    let job_id = +upd.job_id;
    if (!Number.isInteger(job_id))
        throw Object.assign(new Error('No job ID provided'), {code: 400});
    let db = await get_vacancy_db();
    if (await db.countAsync({job_id}) > 0)
        throw Object.assign(new Error('Such Job ID already existing'), {code: 409});

    let insert = `job_id link applied_time`.split(' ').filter(x=>upd.hasOwnProperty(x))
        .reduce((prev, key) =>Object.assign(prev, {[key]: upd[key]}), {});
    insert.last_touch = new Date();
    insert.insert_time = new Date();
    await db.insertAsync(insert);
    return true;
}));

/**
 * @param port {number} server port (default is 6793)
 * @returns {Promise<string>}
 */
export async function serve(port = 6793) {
    return new Promise(resolve => {
        app.listen(port, (err) => {
            resolve('http://localhost:' + port);
        });
    })
}