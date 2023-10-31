# Templates
> Use examples from [resumake.io](https://resumake.io) and [overleaf](https://www.overleaf.com)


## Requirenments 
### Programs
* [MikTex](https://miktex.org/howto/install-miktex)
* [NodeJS](https://nodejs.org/en)
### Resume
#### 1. You can fork this repo and customize you own resume in 
```
tex\resume\main.tex
```
It will generate PDF from Latex with Bind AI rating.
#### 2. You can drop your put your resume here
```
 %HOMEDIR%\job_search\resume\resume.pdf
```
Beware, this resume will not change accordingly Bind AI vacation rating.

### Cover letter
#### 1. You can fully customize cv by your own (only for Latex prof)
```
tex\cv\main.tex
```
#### 2. Use existing LaTex format
To use existing format you need those steps
* Create your photo here
```
%HOMEDIR%\job_search\cv\photo.png
```
* Create txt file with CV letter here
```
%HOMEDIR%\job_search\cv\photo.png
```
With following format:
1. CV contains from 3 parts: header, letter and footer separated by 2 
newlines
2. Header lines contains from name, profession, email, phone, linkein
and github profile links. Any other lines will be inserted as single one.
All should be separated with one newline. Name and profession must
be 1 and 2 line always.
3. Use newline for new paragraph for letter/footer sections

Example of cv.text below
```
John Doe
Programmer
some@email.com
+5 123 456 7
http://linkedin.com.in/john_doe
http://github.com/john_doe
Country, City

Some cover letter here
Additional paragrapgh

Footer
located
here
```
Program will modify content of
```
tex\cv\main.tex
```
And produce Latex->PDF based on your information.
#### 3. Use common CV
You can use common CV pdf, just drop it here
```
%HOMEDIR%\job_search\cv\cv.pdf
```
This CV will append to resume as well

## Known errors
If you see similar in console
```
! LaTeX Error: Command \makecvheadnamewidth already defined.
               Or name \end... illegal, see p.192 of the manual.
```

Rename makecvheadnamewidth to makecvheadnamewidth

If you see similar in console
```
! pdfTeX error (font expansion): auto expansion is only possible with scalable
fonts.
<argument> ...shipout:D \box_use:N \l_shipout_box
                                                  \__shipout_drop_firstpage_...
```
Execute following command:
```
initexmf --mkmaps
```