import Apify from 'apify';
import { getPageInfo } from './page';
import { LABELS, CSS_SELECTORS } from './constants';
import { getUrlLabel, extractUsernameFromUrl, normalizeOutputPageUrl } from './functions';
import { isNotFoundPage } from './page';
import LANGUAGES = require('./languages.json');

const { log } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getInput();

    if (!input || !Array.isArray(input.startUrls) || !input.startUrls.length) {
        throw new Error('You must provide startUrls as an array of Facebook Page URLs');
    }

    const requestQueue = await Apify.openRequestQueue();
    for (const { url } of input.startUrls) {
        await requestQueue.addRequest({
            url,
            userData: {
                label: LABELS.PAGE,
            },
        });
    }

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue,
        useSessionPool: true,
        maxRequestRetries: 3,
        launchPuppeteerFunction: async () =>
            Apify.launchPuppeteer({
                stealth: true,
                useChrome: Apify.isAtHome(),
                args: ['--no-sandbox'],
            }),
        handlePageFunction: async ({ page, request }) => {
            const label = request.userData.label;

            if (label !== LABELS.PAGE) return;

            if (await isNotFoundPage(page)) {
                log.warning(`Page not found: ${request.url}`);
                return;
            }

            const { title, verified } = await getPageInfo(page);

            await Apify.pushData({
                title,
                url: normalizeOutputPageUrl(request.url),
                verified,
            });

            log.info(`Scraped: ${title} (${verified ? 'Verified' : 'Not verified'})`);
        },
        handleFailedRequestFunction: async ({ request }) => {
            log.error(`Request failed: ${request.url}`);
        },
    });

    await crawler.run();
});
