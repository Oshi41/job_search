import node_pdflatex from 'node-pdflatex';

/** @type {(string)=>Promise<Buffer>}*/
const pdf_2_latex = node_pdflatex.default;
import fs from "fs";
import {exec, hash, join_mkdir, safe_rm, sleep} from "oshi_utils";
import os from "os";
import path from "path";
import pdf_text_extract from 'pdf-text-extract';

const resumes_dir = join_mkdir(os.homedir(), 'job_search', 'resumes');
const resume_tex_path = path.join('./resume', 'resume.tex');
const cv_tex_path = path.join('./resume', 'cv.tex');
const get_replace_mask = percentage => Number.isInteger(percentage) ? `Bing AI thinks vacancy suit us ${percentage}\\%`
    : null;

/**
 * @typedef {object} PdfFile
 * @property {string} content - file content
 * @property {string} output_file - file path
 * @property {string} content_hash - hash
 */

/**
 * Generates tex file
 * @param filepath {string}
 * @param to_replace {string | undefined}
 * @returns {string} file content
 */
function generate_tex({filepath, to_replace}) {
    if (!fs.existsSync(filepath))
        throw new Error('No resume provided');
    let content = fs.readFileSync(filepath, 'utf-8');
    if (to_replace)
        content = content.replace('% insert line here', to_replace);
    return content;
}

/**
 * @param tex_file {string} - file path
 * @param to_replace {string | undefined}
 * @returns {Promise<PdfFile>}
 */
async function tex2pdf({tex_file, to_replace}) {
    let content = generate_tex({filepath: tex_file, to_replace});
    let content_hash = hash(content);
    let output_file = path.join(resumes_dir, content_hash + '.pdf');
    if (!fs.existsSync(output_file)) {
        let buf = await pdf_2_latex(content);
        fs.writeFileSync(output_file, buf);
    }
    let pdf = fs.readFileSync(output_file, 'utf-8');
    return {content: pdf, output_file, content_hash};
}

/**
 * Reads resume as PDF file
 * @param percentage {number | undefined}
 * @returns {Promise<PdfFile>}
 */
export async function build_resume({percentage}) {
    /** @type {PdfFile[]}*/
    let pdfs = [
        await tex2pdf({
            tex_file: resume_tex_path,
            to_replace: get_replace_mask(percentage),
        })
    ];

    if (fs.existsSync(cv_tex_path)) {
        pdfs.push(await tex2pdf({
            tex_file: cv_tex_path,
        }));
    }

    if (pdfs.length == 1)
        return pdfs[0];

    let combined_name = path.join(resumes_dir, pdfs.map(x => x.content_hash).join('_') + '.pdf');
    if (!fs.existsSync(combined_name)) {
        let combined_latex = `
\\documentclass[11pt,letterpaper]{article}

\\usepackage[final]{pdfpages}

\\begin{document}

% The following lines are the only ones you need to edit.
${pdfs.map(x => path.basename(x)).map(x => `\\includepdf[pages=-]{${x}}`)}

\\end{document}
    `;
        let combined_latex_filename = combined_name.replace('.pdf', '.tex');
        try {
            fs.writeFileSync(combined_latex_filename, combined_latex, 'utf-8');
            return  await tex2pdf({
                tex_file: combined_latex_filename
            });
        } finally {
            safe_rm(combined_latex);
        }
    }
    return {
        output_file: combined_name,
    };
}


/**
 * Returns resume as markdown
 * @param percentage {number | undefined}
 * @returns {Promise<string>} - markdown content
 */
export async function resume2markdown({percentage}) {
    let {output_file} = await tex2pdf({
        tex_file: resume_tex_path,
        to_replace: get_replace_mask(percentage),
    });
    return await new Promise((resolve, reject) => {
        pdf_text_extract(output_file, {splitPages: false}, (err, text) => {
            if (err)
                return reject(err);
            return resolve(text.join('\n'));
        });
    });
}