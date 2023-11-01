import fs from "fs";
import {exec, filehash, hash, join_mkdir, join_mkfile, safe_rm} from "oshi_utils";
import os from "os";
import path from "path";
import pdf_text_extract from 'pdf-text-extract';

/**
 * @typedef {object} PdfFile
 * @property {string} content - file content
 * @property {string} output_file - file path
 * @property {string} content_hash - hash
 */

async function build2pdf(tex, pdf) {
    if (!fs.existsSync(tex))
        throw new Error('Cannot find file ' + tex);

    let temp_dir = join_mkdir(os.homedir(), 'job_search', 'temp');
    try {
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
    } finally {
        safe_rm(temp_dir);
    }
}

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
 * @returns {Promise<string>}
 */
async function build_cv(to) {
    const cv_path = path.resolve('tex', 'cv', 'main.tex');
    if (!fs.existsSync(cv_path))
        throw new Error(cv_path + ' not found');

    if (!fs.readdirSync(path.resolve('tex', 'cv')).find(x=>x.startsWith('photo.')))
    {
        let src_dir = path.join(os.homedir(), 'job_search', 'cv');
        let src_file = fs.readdirSync(src_dir).find(x=>x.startsWith('photo.'));
        if (!src_file)
            throw new Error('No photo provided');
        fs.linkSync(path.join(src_dir, src_file), path.resolve(cv_path, '..', src_file));
    }
    if (!fs.readdirSync(path.resolve('tex', 'cv')).find(x=>x.startsWith('photo.')))
        throw new Error('No photo provided');

    const cv_text = [
        path.resolve('tex', 'cv', 'cv.text'),
        path.join(os.homedir(), 'job_search', 'cv', 'cv.text')
    ].find(x => fs.existsSync(x));
    if (!cv_text)
        throw new Error('CV text file was not found');

    let [header, content, footer] = fs.readFileSync(cv_text, 'utf-8').split(/\r?\n\r?\n/).filter(Boolean);

    let hdr_lines = header.split('\n').map(x => x.trim()).filter(Boolean);

    function find_and_delete(search) {
        let find = hdr_lines.find(x => {
            if (search instanceof RegExp)
                return x.replace(search, '').length < 1;
            else
                return x.toLowerCase().includes(search);
        });
        if (find)
            hdr_lines = hdr_lines.filter(x => x != find);
        return find;
    }

    function join_as_par(str) {
        return escape_tex(str).split('\n').map(x => x.trim()).filter(Boolean).map(x => `\\par{${x}}`).join('\n');
    }

    let cv_content = join_as_par(content);
    let cv_footer = join_as_par(footer);

    let name = hdr_lines.shift();
    let profession = hdr_lines.shift();

    let linkedin = find_and_delete('linkedin');
    let github = find_and_delete('github');
    let email = find_and_delete('@');
    let phone = find_and_delete(/[0-9 +_]/g);

    let rename_map = {
        ['insert-name']: name,
        ['insert-profession']: profession,

        ['insert-linkedin']: new URL(linkedin).pathname.split('/').filter(Boolean)[1],
        ['insert-github']: new URL(github).pathname.split('/').filter(Boolean)[0],
        ['insert-email']: email,
        ['insert-phone']: phone,
        ['insert-location']: escape_tex(hdr_lines.join('\n')),

        ['insert-letter']: cv_content,
        ['insert-footer']: cv_footer,
    };

    let tex_content = fs.readFileSync(cv_path, 'utf-8');

    function rm_line(search_srt) {
        let index = tex_content.indexOf(search_srt);
        if (index < 0)
            return;
        let left = tex_content.lastIndexOf('\n', index);
        let right = tex_content.indexOf('\n', index + 1);
        let trimmed = tex_content.slice(0, left) + tex_content.split(right);
        tex_content = trimmed;
    }

    for (let [search_str, to_replace] of Object.entries(rename_map)) {
        if (!to_replace)
            rm_line(search_str);
        else
            tex_content = tex_content.replace(search_str, to_replace);
    }

    let temp_file = join_mkfile('tex', 'cv', '_cv.tex');
    try {
        fs.writeFileSync(temp_file, tex_content, 'utf-8');
        await build2pdf(temp_file, to);
        return to;
    } finally {
        safe_rm(temp_file);
    }
}

/**
 * @param to {string} where to put PDF file
 * @param percentage {number | undefined} - vacancy AI percentage
 * @returns {Promise<string>}
 */
async function _build_resume(to, percentage = Number.NaN) {
    let tex_path = path.resolve('tex', 'resume', 'main.tex');
    if (!fs.existsSync(tex_path))
        throw new Error(tex_path + ' not found');

    let tex_content = fs.readFileSync(tex_path, 'utf-8');
    if (Number.isInteger(percentage)) {
        tex_content = tex_content.replace('% insert line here',
            `\\underline{Bing AI thinks this vacancy suits us ${percentage}\\%}`);
    }
    let temp_tex_file = path.resolve(tex_path, '..', '_temp.tex');
    try {
        fs.writeFileSync(temp_tex_file, tex_content, 'utf-8');
        await build2pdf(temp_tex_file, to);
        return to;
    } finally {
        safe_rm(temp_tex_file);
    }
}

export async function build_resume(percentage = Number.NaN) {
    let dir = join_mkdir(os.homedir(), 'job_search', 'resume',
        (percentage || 'common')+'');

    let resume_pdf = path.join(dir, 'resume.pdf');
    if (!fs.existsSync(resume_pdf))
        await _build_resume(resume_pdf, percentage);
    if (!fs.existsSync(resume_pdf)) {
        const common_resume = path.join(os.homedir(), 'job_search', 'resume', 'resume.pdf');
        if (fs.existsSync(common_resume)) {
            // make hard link here, no copy
            fs.linkSync(common_resume, resume_pdf);
        }
    }
    if (!fs.existsSync(resume_pdf))
        throw new Error('Cannot find/generate resume');

    let resume_txt = path.join(dir, 'resume.txt');
    // need to create it only for common/default resume
    if (!Number.isNaN(percentage) && !fs.existsSync(resume_txt))
    {
        await new Promise((resolve, reject) => {
            pdf_text_extract(resume_pdf, {}, function (err, data) {
                if (err)
                    return reject(err);
                let text = data.join('\n');
                fs.writeFileSync(resume_txt, text, 'utf-8');
                resolve(true);
            });
        })
    }

    let cv_pdf = path.join(dir, 'cv.pdf');
    if (!fs.existsSync(cv_pdf)) {
        const common_cv = path.join(os.homedir(), 'job_search', 'cv', 'cv.pdf');
        if (fs.existsSync(common_cv)) {
            // make hard link here, no copy
            fs.linkSync(common_cv, cv_pdf);
        } else {
            await build_cv(cv_pdf);
        }
    }
    if (!fs.existsSync(cv_pdf))
        throw new Error('Cannot find/generate cover letter');

    let result_pdf = path.join(dir, 'resume_and_cv.pdf');
    if (!fs.existsSync(result_pdf)) {
        let combined_tex = `
\\documentclass[11pt,a4paper]{article}
\\usepackage[final]{pdfpages}
\\begin{document}
\\includepdf[pages=-]{${path.basename(resume_pdf)}}
\\includepdf[pages=-]{${path.basename(cv_pdf)}}
\\end{document}
        `;
        let temp_tex_file = join_mkfile(dir, 'combined.tex');
        try {
            fs.writeFileSync(temp_tex_file, combined_tex, 'utf-8');
            await build2pdf(temp_tex_file, result_pdf);
        } finally {
            safe_rm(temp_tex_file);
        }
    }

    if (!fs.existsSync(result_pdf))
        throw new Error('Cannot generate resume with CV comined');

    return result_pdf;
}