import express from 'express';
import path from "path";
import {get_vacancy_db, handler, update_one} from "../../utils.js";

const app = express();

app.use(express.json());
app.use(express.text());
app.use(express.static(path.resolve('report', 'frontend'))); // HTML files

app.post('/set_applied', handler(async (req, res) => {
    let job_id = +req.body;
    if (!Number.isInteger(job_id))
        throw new Error('Wrong job id');

    let db = await get_vacancy_db();
    await update_one(db, {job_id}, {applied_time: new Date()});
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