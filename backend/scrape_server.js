import {get_jobs_db, handler} from "../utils.js";
import {read_settings} from "./utils.js";
import {date} from "oshi_utils";

/**
 * @param app {Express}
 */
export function install(app) {
    app.get('/links', handler(async req => {
        let cfg = await read_settings();
        let db = await get_jobs_db();

        let any_q = {
            type: 'scrape_links',
            error: {$exists: false},
        };
        cfg.searches.forEach(x => any_q['links.' + x] = {$exists: true});
        let exact_q = {
            ...any_q,
            end: {$gte: date.add(new Date(), {d: -1})},
        };
        let refresh_q = {
            ...any_q,
            end: {$gte: date.add(new Date(), {h: -5})},
        };
        let running_q = {
            ...any_q,
            end: {$exists: false},
        };


        if (// no records more fresh that 5h
            await db.countAsync(refresh_q) < 1
            // no running jobs
            && await db.countAsync(running_q) < 1)
        {
            // scheduling refresh job
            let job = {
                type: 'scrape_links',
                created: new Date(),
                links: {},
            };
            cfg.searches?.forEach(x => {
                let url = new URL('https://www.linkedin.com/jobs/search');
                url.searchParams.set('keywords', x);
                url.searchParams.set('location', cfg.location);
                job.links[x] = {url: url.toString()};
            });
            await db.insertAsync(job);
        }

        let last_one = await db.findOneAsync(exact_q);
        let in_progress = await db.findAsync({
            type: 'scrape_search',
            end: {$exists: false},
        });
        if (!last_one)
            return {loading: true};
        let result = {};
        for (let [name, {url, total}] of Object.entries(last_one.links))
        {
            result[name] = {
                url,
                total,
                scraping: in_progress.some(x=>x.name == name),
            };
        }
        return result;
    }));
    app.post('/scrape', handler(async req=>{
        let {name, url} = JSON.parse(req.body);
        let db = await get_jobs_db();
        let running_q = {
            type: 'scrape_search',
            name,
            end: {$exists: false},
        };
        if (!await db.countAsync(running_q))
        {
            let job = {
                type: 'scrape_search',
                name,
                url,
                created: new Date(),
            };
            await db.insertAsync(job);
        }
        return true;
    }));
}