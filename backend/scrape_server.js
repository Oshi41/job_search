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
            type: 'scrape_vacancies_count',
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
                type: 'scrape_vacancies_count',
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
        if (!last_one)
            return {loading: true}

        return last_one.links;
    }));
}