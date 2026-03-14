"""
Submit the NJ Rebates Explained script to HeyGen for avatar video generation.
Updated script: incentives up to $16k max, rest via OBR, no utility company mention,
added heating+cooling benefit for homes without central air.
"""
import requests
import json
import time

API_KEY = "sk_V2_hgu_kuWsl5g7gas_8wdGQvskgAtGaQS4sxh9cvFdDAd7XNf4"
HEADERS = {
    "X-Api-Key": API_KEY,
    "Content-Type": "application/json"
}

# Updated script — corrected per Ana's feedback
SCRIPT = (
    "Did you know New Jersey homeowners can get up to sixteen thousand dollars in incentives "
    "just for upgrading their heating system? Let me show you exactly how. "
    "Hi, I am from Mechanical Enterprise, New Jersey's heat pump and HVAC specialists. "
    "Right now, New Jersey homeowners can receive up to sixteen thousand dollars in incentives "
    "when they replace an old heating system with a high-efficiency heat pump. "
    "The incentives come from the NJ Clean Heat program and federal tax credits. "
    "Any remaining balance after incentives can be covered through On-Bill Repayment, "
    "which means zero dollars out of pocket, ever. "
    "On-Bill Repayment spreads the remaining cost over your utility bill at zero percent interest, "
    "and your monthly energy savings often cover most or all of that payment. "
    "Here is something most people do not realize. "
    "If your home currently only has window units, a heat pump changes everything. "
    "You will now have full home heating AND cooling, all in one efficient system. "
    "No more window units in the summer. No more high heating bills in the winter. "
    "One system handles it all, year round. "
    "At Mechanical Enterprise, we handle every piece of paperwork, every application, "
    "and every step of the installation. You just say yes. "
    "Call us at 862-419-1763 or visit mechanicalenterprise.com to book your free assessment. "
    "We will show you exactly what you qualify for."
)

# Daisy-inskirt-20220818 is confirmed available on this account
PAYLOAD = {
    "video_inputs": [
        {
            "character": {
                "type": "avatar",
                "avatar_id": "Daisy-inskirt-20220818",
                "avatar_style": "normal"
            },
            "voice": {
                "type": "text",
                "input_text": SCRIPT,
                "voice_id": "1bd001e7e50f421d891986aad5158bc8"  # Rachel — professional US female
            },
            "background": {
                "type": "color",
                "value": "#1e3a5f"
            }
        }
    ],
    "dimension": {"width": 1280, "height": 720},
    "aspect_ratio": "16:9"
}

print("Submitting video to HeyGen...")
resp = requests.post(
    "https://api.heygen.com/v2/video/generate",
    headers=HEADERS,
    json=PAYLOAD,
    timeout=30
)
print(f"Status: {resp.status_code}")
print(resp.text)

if resp.status_code == 200:
    data = resp.json()
    video_id = data.get("data", {}).get("video_id")
    if video_id:
        print(f"\nVideo ID: {video_id}")
        print("Polling for completion...")
        for i in range(60):  # poll up to 10 minutes
            time.sleep(10)
            status_resp = requests.get(
                f"https://api.heygen.com/v1/video_status.get?video_id={video_id}",
                headers=HEADERS,
                timeout=15
            )
            status_data = status_resp.json()
            status = status_data.get("data", {}).get("status", "unknown")
            print(f"  [{i*10}s] Status: {status}")
            if status == "completed":
                video_url = status_data.get("data", {}).get("video_url")
                print(f"\n✅ VIDEO READY: {video_url}")
                break
            elif status == "failed":
                print(f"\n❌ FAILED: {status_data}")
                break
