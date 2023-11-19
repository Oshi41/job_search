import path from "path";
import fs from "fs";
import os from "os";
import {handler, throw_err} from "../utils.js";
import pdf_text_extract from 'pdf-text-extract';
import {join_mkdir, clamp, promisify, exec, safe_rm, join_mkfile, Settings, qw} from "oshi_utils";

const resume_directory = join_mkdir(os.homedir(), 'job_search', 'resumes');
const settings_path = join_mkfile(os.homedir(), 'job_search', 'resumes', 'settings.json');
const photo_file = path.resolve(settings_path, '..', 'photo.png');
let tex_regexes = new Map([
    [/\\/g, '/'], // must be on first line

    [/\$/g, '\\$'],
    [/_/g, '\\_'],
    [/\{/g, '\\{'],
    [/}/g, '\\}'],
    [/%/g, '\\%'],
    [/\^/g, '\\^'],
    [/&/g, '\\&'],
    [/#/g, '\\#'],
]);

function escape_tex(str) {
    tex_regexes.forEach((to_replace, regexp) => {
        str = str.replace(regexp, to_replace);
    });
    return str;
}

/**
 * @param filepath {string}
 * @returns {Promise<string>}
 */
const pdf2text = async filepath => {
    return await new Promise((resolve, reject) => {
        pdf_text_extract(filepath, {}, function (err, data) {
            if (err)
                return reject(err);
            resolve(data.join('\n'));
        });
    });
};

const tex2pdf = promisify(
    /**
     * @param tex {string} tex file name
     * @param pdf {string} output file name
     */
    async function (tex, pdf) {
        if (!fs.existsSync(tex))
            throw new Error('Cannot find file ' + tex);

        let temp_dir = join_mkdir(os.homedir(), 'job_search', 'temp');
        this.finally(() => safe_rm(temp_dir));

        let res = await exec(`pdflatex "${tex}" --output-directory "${temp_dir}"`, {
            cwd: path.dirname(tex),
        });
        if (res.code)
            throw new Error(res.result);
        let generated_pdf = fs.readdirSync(temp_dir).find(x => x.endsWith('.pdf'));
        if (!generated_pdf)
            throw new Error('Cannot generate PDF file, check output results: ' + res.result);
        join_mkdir(path.dirname(pdf));
        fs.copyFileSync(path.join(temp_dir, generated_pdf), pdf);
    });

/**
 * @typedef {object} ResumeBuildInfo
 * @property {string} name
 * @property {string} title
 * @property {string} email
 * @property {string} location
 * @property {string} phone
 * @property {string[]} links
 * @property {string} photo Base64 buffer or photo path
 *
 * @property {string} ai_message. Should contains %s as substring for percentage placement
 * @property {string} cv_text
 * @property {string} cv_footer
 *
 * @property {number | undefined} percentage
 */

/**
 *
 * @param info {ResumeBuildInfo}
 * @returns {Promise<void>}
 */
const build_resume = promisify(
    /**
     * @param info {ResumeBuildInfo}
     * @returns {Promise<never>}
     */
    async function (info) {
        if (Number.isInteger(info.percentage))
            info.percentage = clamp(0, Math.floor(info.percentage), 100);
        else
            info.percentage = 'common';

        let dir = join_mkdir(resume_directory, info.percentage);
        let filepath = path.join(dir, 'resume', 'tex');
        // copy resume tex using hard links
        if (!fs.existsSync(filepath)) {
            let from = path.resolve('tex', 'resume');
            for (let basename of fs.readdirSync(from)) {
                fs.linkSync(
                    path.join(from, basename),
                    path.join(filepath, basename),
                );
            }
        }

        filepath = path.join(dir, 'cv', 'tex');
        // copy cv tex
        if (!fs.existsSync(filepath)) {
            let from = path.resolve('tex', 'cv');
            for (let basename of fs.readdirSync(from)) {
                fs.linkSync(
                    path.join(from, basename),
                    path.join(filepath, basename),
                );
            }
        }

        filepath = path.resolve('tex', 'cv', 'photo.png');
        if (!fs.existsSync(filepath)) {
            if (fs.existsSync(info.photo))
                fs.linkSync(info.photo, filepath);
            else {
                let buf = Buffer.from(info.photo, 'base64');
                fs.writeFileSync(filepath, buf);
            }
        }

        if (!fs.existsSync(filepath))
            return throw_err('No photo provided', 400);

        filepath = path.join(dir, 'resume', 'resume.pdf');
        if (!fs.existsSync(filepath)) {
            let tex_file = path.join(dir, 'resume', 'tex', 'main.tex');
            if (!fs.existsSync(tex_file))
                return throw_err('Cannot find main.tex', 500);

            let content = fs.readFileSync(tex_file, 'utf-8');
            content = content
                .replace('_insert_name_', info.name)
                .replace('_insert_location_', info.location)
                .replace('_insert_phone_', info.phone)
                .replace('_insert_email_', info.email);

            if (Number.isInteger(info.percentage)) {
                if (!info.ai_message.includes('%s'))
                    return throw_err('AI message for resume must have "%s"', 400);

                content = content.replace('% insert line here',
                    info.ai_message.replace('%s', info.percentage));
            }

            function use_resume_link(substring, url_part) {
                let replacement = info.links.find(x => x.includes(url_part));
                if (replacement) {
                    let url = new URL(replacement);
                    replacement = url.host.replace('www.', '') + url.pathname;
                }

                if (!replacement) {
                    content = content.split('\n').filter(x => !x.includes(substring)).join('\n');
                } else {
                    content = content.replace(substring, replacement);
                }
            }

            use_resume_link('_insert_linkedin_', 'linkedin');
            use_resume_link('_insert_github_', 'github');

            safe_rm(tex_file); // rm link
            fs.writeFileSync(tex_file, content, 'utf-8');
            await tex2pdf(tex_file, filepath);
        }

        filepath = path.join(dir, 'cv', 'cv.pdf');
        if (!fs.existsSync(filepath)) {
            function find_url(substr) {
                let find = info.links.find(x => x.includes(substr));
                if (find)
                    return new URL(find).pathname.split('/');
                return [];
            }

            function join_as_par(str) {
                return escape_tex(str).split('\n').map(x => x.trim()).filter(Boolean).map(x => `\\par{${x}}`).join('\n');
            }

            function rm_line(search_srt) {
                let index = tex_content.indexOf(search_srt);
                if (index < 0)
                    return;
                let left = tex_content.lastIndexOf('\n', index);
                let right = tex_content.indexOf('\n', index + 1);
                let trimmed = tex_content.slice(0, left) + tex_content.split(right);
                tex_content = trimmed;
            }

            let replace_map = {
                'insert-name': info.name,
                'insert-profession': info.title,

                'insert-linkedin': find_url('linkedin')[1],
                'insert-github': find_url('linkedin')[0],
                'insert-email': info.email,
                'insert-phone': info.phone,
                'insert-location': escape_tex(info.location.join('\n')),

                'insert-letter': join_as_par(info.cv_text),
                'insert-footer': join_as_par(info.cv_footer),
            };
            let tex_file = path.resolve('tex', 'cv', 'main.tex');
            let tex_content = fs.readFileSync(tex_file, 'utf-8');
            for (let [search_str, to_replace] of Object.entries(replace_map)) {
                if (!to_replace)
                    rm_line(search_str);
                else
                    tex_content = tex_content.replace(search_str, to_replace);
            }
            safe_rm(tex_file); // rm link
            fs.writeFileSync(tex_file, tex_content, 'utf-8');
            await tex2pdf(tex_file, filepath);
        }

        filepath = path.join(dir, 'resume_and_letter.pdf')
        if (!fs.existsSync(filepath)) {
            let tex_content = `
\\documentclass[11pt,a4paper]{article}
\\usepackage[final]{pdfpages}
\\begin{document}
\\includepdf[pages=-]{resume/resume.pdf}
\\includepdf[pages=-]{cv/cv.pdf}
\\end{document}
        `;
            let tex_path = path.join(dir, 'resume_and_letter.tex');
            this.finally(() => safe_rm(tex_path));
            fs.writeFileSync(tex_path, tex_content, 'utf-8');
            await tex2pdf(tex_path, filepath);
        }
    });

/** @returns {Promise<ResumeBuildInfo>}*/
async function read_settings() {
    let settings = new Settings(settings_path);
    let data = await settings.read(() => ({
        links: [],
    }));
    if (fs.existsSync(photo_file))
    {
        let buff = fs.readFileSync(photo_file)
        let base64 = buff.toString('base64');
        data.photo = `data:image/png;base64,`+base64;
    }
    return data;
}


/**
 * @param app {Express}
 */
export function install(app) {
    app.get('/resume_settings', handler(async req => {
        return read_settings();
    }));
    app.post('/resume_settings', handler(async req => {
        const existing = await read_settings();
        let body = JSON.parse(req.body);
        let keys = qw`name title email location phone ai_message links photo cv_text cv_footer`;
        for (let key of keys.filter(x => body.hasOwnProperty(x)))
            existing[key] = body[key];

        let empty_key = keys.find(x => !existing[x])
        if (empty_key)
            return throw_err(`You must set "${empty_key}"`, 400);

        let base64 = existing.photo.split('base64,')[1];
        delete existing.photo;

        let buff = Buffer.from(base64, 'base64');
        fs.writeFileSync(photo_file, buff);

        let settings = new Settings(settings_path);
        settings.save(existing);
        return true;
    }));

    app.get('/resume', handler(async req => {
        let data = {resume: {}, cv: {}};
        let directory = path.dirname(await build_resume(+req.query.percentage));
        if (!fs.existsSync(directory))
            throw_err('Cannot generate resume', 500);

        let resume_pdf_file = path.join(directory, 'resume.pdf');
        let cv_pdf_file = path.join(directory, 'cv.pdf');

        if (req.query.pdf !== false) {
            data.resume.pdf = fs.readFileSync(resume_pdf_file, 'utf-8');
            data.cv.pdf = fs.readFileSync(cv_pdf_file, 'utf-8');
        }
        if (req.query.text !== false) {
            data.resume.text = await pdf2text(resume_pdf_file);
            data.cv.text = await pdf2text(cv_pdf_file);
        }
        if (req.query.tex !== false) {
            data.resume.text = fs.readFileSync(path.resolve('tex', 'resume', 'main.tex'), 'utf-8');
            data.cv.text = fs.readFileSync(path.resolve('tex', 'cv', 'main.tex'), 'utf-8');
        }

        return data;
    }));
    app.post('/preview', handler(async req => {
        let tex = req.body.toString();

        const subsctrings = [
            '% insert line here',
            '_insert_name_',
            '_insert_location_',
            '_insert_phone_',
            '_insert_email_',
            '_insert_linkedin_',
            '_insert_github_',
        ];

        let missing = subsctrings.find(x => !tex.includes(x))
        if (missing)
            throw_err(`You should left "${missing}" as required substring replacing`, 400);

        let percentage = +req.query.percentage;
        return true;
    }));
}