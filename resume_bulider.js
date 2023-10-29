import node_pdflatex from 'node-pdflatex';
import fs from "fs";
import {join_mkfile} from "oshi_utils";
import os from "os";
import path from "path";

const pdf_2_latex = node_pdflatex.default;

const resume_tex_path = path.join('./resume', 'resume.tex');

function read_tex_file(encoding) {
    if (!fs.existsSync(resume_tex_path))
        throw new Error('No tex file provided');
    return  fs.readFileSync(resume_tex_path, encoding);
}

/**
 *
 * @param filepath {string} tex resume file
 * @param output_name {string} plain file name without extension (like resume_1 or resume_90%)
 * @returns {Promise<string>} path to created pdf file
 */
export async function resume_to_pdf({output_name}){
    let source = read_tex_file('utf-8');
    let buff = await pdf_2_latex(source), fp;
    fs.writeFileSync(fp = join_mkfile(os.homedir(), 'job_search', 'resume_output', output_name+'.pdf'), buff);
    return fp;
}

export async function resume_to_markdown({output_name}){
    let source = read_tex_file('utf-8');
}

resume_to_pdf({output_name: 'text_resume'}).then(x=>console.log(x));