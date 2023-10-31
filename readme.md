# Job search
Automation script for LinkedIn job search and apply.

# Dependencies:
* [MikTex](https://miktex.org/download)
* [NodeJS](https://nodejs.org/en)
* Prepare resume and CV (optionally) in LaTex format. Use can use
[resumake.io](https://resumake.io) or any other available LaTex editing
service or make resume/cv manually.

# Commands
## config
Configuration stored locally in JSON file
```
{
    // LinkedIn email login
    login: string,
    
    // LinkedIn account password
    pass: string,
    
    // Job searches for LinkedIn. Used in scraping
    searches: string[],
    
    // Desired job location
    // Default: 'worldwide'
    location: string,
}
```
Pass **--encrypt** for JSON config encryption: program will ask password
which will be used later as decrypt pass.

Additionally, you need to create own resume/cv letter. Drop resume here:
```
./resume/resume.tex
```
And cover letter can by anywhere in
```
    ./resume/cv.tex
    HOMEDIR/job_search/cv.tex
    HOMEDIR/job_search/resumes/cv.tex
```

## scrape
* Login in LinkedIn
* Iterate through every settings.searches with 
settings.location (see **config** section)
* Iterate through all 5 vacanciy pages
* Visit every job vacancy, gets it text and stores vacancy in 
local database

## analyze
* Iterates through all vacancies without ai_resp property
* For every vacancy creating prompt for Bing AI chat and waits
for response.
* AI response is saving for each vacancy

Was not well-debugged. May face captcha, so it's not fully autonomous
