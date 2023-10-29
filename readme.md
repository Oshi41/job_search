# Job search
Automation script for LinkedIn job search and apply.

# Dependencies:
* [MikTex](https://miktex.org/download)
* [NodeJS](https://nodejs.org/en)

# Commands
## config
Using to configurate script. You need to pass:
* LinkedIn email and password. It will be saved locally.
**Pass --encrypt to use pasword for config encryption**.
* LinkedIn job searches. Used to perform scaping vacancies for passed keywords.
* Desired job location

## scrape
Login into LinkedIn and perform scraping. Script will iterate through all
LinkedIn job searches from **config** with desired job location from
**config** and scan pages to add it into local database. Scrpt retreives
vacancy id, applied amount, vacancy text, date, etx

## analyze
Performed in Edge browser only. Uses ChatBing for AI analyze how this
vacancy is suitable for your resume (0-100%). Take a bit more time,
was not well-debugged.

