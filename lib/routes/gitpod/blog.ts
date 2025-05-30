import { Route } from '@/types';

import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { rootUrl } from './utils';
import { art } from '@/utils/render';
import path from 'node:path';

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/gitpod/blog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['gitpod.io/blog', 'gitpod.io/'],
        },
    ],
    name: 'Blog',
    maintainers: ['TonyRL'],
    handler,
    url: 'gitpod.io/blog',
};

async function handler(ctx) {
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 10;
    const response = await got(rootUrl + '/blog');
    const $ = load(response.data);
    let items = $('div[class^="flex justify-center"]')
        .slice(0, limit)
        .toArray()
        .map((item) => {
            item = $(item);
            return {
                title: item.find('h2').text(),
                link: rootUrl + item.find('a').attr('href'),
                pubDate: parseDate(item.find('span[class^=date]').text()),
            };
        });

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got(item.link);
                const content = load(detailResponse.data);

                const headerImg = content('img[class^=max-h]');
                item.description = art(path.join(__dirname, 'templates/description.art'), {
                    img: headerImg.attr('src'),
                    alt: headerImg.attr('alt'),
                    content: content('div[class^=content-blog]').html(),
                });
                item.author = content('span.avatars a')
                    .toArray()
                    .map((e) => content(e).text().trim())
                    .join(', ');
                return item;
            })
        )
    );

    const ret = {
        title: $('title').text(),
        link: rootUrl + '/blog',
        description: $('meta[name="description"]').attr('content'),
        language: 'en-US',
        item: items,
    };

    ctx.set('json', ret);
    return ret;
}
