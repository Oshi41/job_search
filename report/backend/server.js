import express from 'express';
import path from "path";
import {get_vacancy_db, handler, update_one,} from "../../utils.js";
import {qw} from "oshi_utils";

const app = express();

app.use(express.json());
app.use(express.text());
app.use(express.static(path.resolve('report', 'frontend'))); // HTML files

app.patch('/vacancy', handler(async (req, res) => {
    let upd = JSON.parse(req.body);
    if (Object.keys(upd).length < 2 || !upd.job_id)
        throw Object.assign(new Error('Wrong update object'), {code: 400});
    let q = {job_id: +upd.job_id};
    let db = await get_vacancy_db();
    let upd_req = {$set: {}, $unset: {}};
    `percentage ai_resp applied_time`.split(' ').forEach(key=>{
        if (!upd.hasOwnProperty(key))
            upd_req.$unset[key] = 1;
        else
            upd_req.$set[key] = upd[key];
    });
    await db.update(q, upd_req);
    return true;
}));
app.post('/vacancies', handler(async req => {
    let db = await get_vacancy_db();
    let {find, sort, skip, limit} = JSON.parse(req.body);
    let q = {};
    function split_keys(str) {
        return str.split(' ').filter(x=>find.hasOwnProperty(x));
    }
    let exact_keys = split_keys('easy_apply');
    let numeric_regex_keys = split_keys('job_id');
    let numeric_exact_keys = split_keys('percentage applies');
    let text_regex_keys = split_keys('location');

    for (let key of exact_keys)
        q[key] = find[key];
    for (let key of numeric_exact_keys)
        q[key] = +find[key];
    for (let key of text_regex_keys)
        q[key] = {$regex: new RegExp(find[key], 'gi')};
    if (numeric_regex_keys.length)
    {
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

    // special case
    if (find.company_name)
    {
        q.$or = [
            {company_name: {$regex: find.company_name}},
            {text: {$regex: find.company_name}},
            {ai_resp: {$regex: find.company_name}},
        ];
    }


    for (let key of Object.keys(sort))
        sort[key] = sort[key] == 'asc' ? 1 : -1;

    let items = await db.find(q).sort(sort).skip(skip).limit(limit);
    let count = await db.count(q);
    return {items, count};
}));

/**
 * @param port {number} server port (default is 6793)
 * @returns {Promise<string>}
 */
export async function serve(port = 6793){
    return new Promise(resolve => {
        app.listen(port, (err)=>{
            resolve('http://localhost:'+port);
        });
    })
}