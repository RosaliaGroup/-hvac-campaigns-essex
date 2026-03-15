import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = 'act_842920828353492';

// Map campaign names to their image files
const campaigns = [
  {
    name: 'ME — HVAC Replacement | Essex County',
    imagePath: '/home/ubuntu/hvac-ads/hvac-v3.jpg',
  },
  {
    name: 'ME — Oil Replacement | Essex County',
    imagePath: '/home/ubuntu/hvac-ads/oil-v3.jpg',
  },
  {
    name: 'ME — Rebate Hunter | Essex County',
    imagePath: '/home/ubuntu/hvac-ads/rebate-v3.jpg',
  },
];

async function uploadImage(imagePath) {
  const form = new FormData();
  form.append('filename', fs.createReadStream(imagePath));
  form.append('access_token', ACCESS_TOKEN);

  const res = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adimages`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(`Image upload error: ${JSON.stringify(data.error)}`);
  const filename = path.basename(imagePath);
  const hash = data.images[filename]?.hash;
  console.log(`  Uploaded ${filename} → hash: ${hash}`);
  return hash;
}

async function getCampaigns() {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name&access_token=${ACCESS_TOKEN}`
  );
  const data = await res.json();
  return data.data || [];
}

async function getAdSets(campaignId) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${campaignId}/adsets?fields=id,name&access_token=${ACCESS_TOKEN}`
  );
  const data = await res.json();
  return data.data || [];
}

async function getAds(adSetId) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${adSetId}/ads?fields=id,name,creative&access_token=${ACCESS_TOKEN}`
  );
  const data = await res.json();
  return data.data || [];
}

async function getCreative(creativeId) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${creativeId}?fields=id,name,object_story_spec,image_hash&access_token=${ACCESS_TOKEN}`
  );
  return res.json();
}

async function updateAdCreative(adId, imageHash, existingCreative) {
  // Create a new creative with the updated image hash
  const spec = existingCreative.object_story_spec;
  
  // Update the image hash in the link data
  if (spec?.link_data) {
    spec.link_data.image_hash = imageHash;
  }

  // Create new creative
  const createRes = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: existingCreative.name + ' (updated)',
      object_story_spec: spec,
      access_token: ACCESS_TOKEN,
    }),
  });
  const newCreative = await createRes.json();
  if (newCreative.error) throw new Error(`Create creative error: ${JSON.stringify(newCreative.error)}`);

  // Update the ad to use the new creative
  const updateRes = await fetch(`https://graph.facebook.com/v19.0/${adId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creative: { creative_id: newCreative.id },
      access_token: ACCESS_TOKEN,
    }),
  });
  const updateData = await updateRes.json();
  if (updateData.error) throw new Error(`Update ad error: ${JSON.stringify(updateData.error)}`);
  return newCreative.id;
}

async function main() {
  console.log('Fetching campaigns...');
  const allCampaigns = await getCampaigns();
  
  for (const campaign of campaigns) {
    console.log(`\nProcessing: ${campaign.name}`);
    
    // Find matching campaign
    const match = allCampaigns.find(c => c.name === campaign.name);
    if (!match) {
      console.log(`  ❌ Campaign not found: ${campaign.name}`);
      continue;
    }
    
    // Upload image
    console.log(`  Uploading image: ${campaign.imagePath}`);
    const imageHash = await uploadImage(campaign.imagePath);
    
    // Get ad sets
    const adSets = await getAdSets(match.id);
    for (const adSet of adSets) {
      const ads = await getAds(adSet.id);
      for (const ad of ads) {
        if (!ad.creative?.id) continue;
        const creative = await getCreative(ad.creative.id);
        const newCreativeId = await updateAdCreative(ad.id, imageHash, creative);
        console.log(`  ✅ Updated ad ${ad.id} with new creative ${newCreativeId}`);
      }
    }
  }
  
  console.log('\nAll done! Images uploaded and creatives updated.');
}

main().catch(console.error);
