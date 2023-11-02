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
app.get('/vacancies', handler(async req => {
    let db = await get_vacancy_db();
    let all = await db.find({});
    return all;
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