import { Route } from './src/routes/e.$slug.tsx';

// Mock event
const loaderData = {
  event: {
    title: "Lagos Tech Fest 2026",
    city: "Lagos",
    start_datetime: "2026-11-20T10:00:00.000Z",
    description: "The biggest tech festival in West Africa featuring top speakers, workshops, and networking events for developers and founders.",
    cover_image_url: "https://example.com/image.jpg"
  }
};

const headConfig = Route.options.head({ loaderData });
console.log(JSON.stringify(headConfig, null, 2));
