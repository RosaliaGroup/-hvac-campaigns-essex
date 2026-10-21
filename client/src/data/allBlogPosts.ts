import { blogPosts } from "./blogPosts";
import { commercialGrowthPosts } from "./commercialGrowthPosts";
import { sortPublishedPosts } from "../../../shared/blogPublication";

// One inventory for the website, sitemap, metadata and prerendering.
const all = [...commercialGrowthPosts, ...blogPosts];
if (new Set(all.map(post => post.slug)).size !== all.length) throw new Error("Duplicate published blog slug");
export const allBlogPosts = sortPublishedPosts(all);
