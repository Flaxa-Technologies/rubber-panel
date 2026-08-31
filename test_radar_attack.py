import sys
import requests
import time
import concurrent.futures

# Configure UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TARGET_URL = "http://127.0.0.1:3001/"
NODE_RADAR_API = "http://127.0.0.1:3001/api/agent/radar"
NODE_TOKEN = "rp_node_84d762ccac46722466c12754b6d43e15e007c2fa341a012fb73eaab86709f554"

# Simulated external attacker IP (Tor exit / botnet address)
ATTACKER_IP = "185.220.101.44"

print("=" * 65)
print("  >>> RUBBER RADAR DEFENSE ENGINE ATTACK SIMULATION <<<")
print(f"  Target:       {TARGET_URL}")
print(f"  Attacker IP:  {ATTACKER_IP}")
print(f"  Threshold:    20 requests in 10s")
print("=" * 65)

headers = {
    "X-Forwarded-For": ATTACKER_IP,
    "User-Agent": "MinecraftBot/1.21.4 (FloodAttack)"
}

results = {"200": 0, "403": 0, "other": 0}

def send_request(req_id):
    try:
        r = requests.get(TARGET_URL, headers=headers, timeout=3)
        if r.status_code == 200:
            results["200"] += 1
            print(f"  [Req #{req_id:02d}] [ALLOWED] 200 OK")
        elif r.status_code == 403:
            results["403"] += 1
            print(f"  [Req #{req_id:02d}] [BANNED]  403 FORBIDDEN - Quarantined by Rubber Radar!")
        else:
            results["other"] += 1
            print(f"  [Req #{req_id:02d}] [STATUS]  {r.status_code}")
    except Exception as e:
        print(f"  [Req #{req_id:02d}] [ERROR]   {e}")

print("\n>>> [Phase 1] Launching rapid connection burst (35 requests)...")

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(send_request, i + 1) for i in range(35)]
    concurrent.futures.wait(futures)

print("\n" + "=" * 65)
print("  ATTACK RESULTS SUMMARY")
print(f"  Allowed (200 OK):               {results['200']} requests (Before threshold)")
print(f"  Blocked/Punished (403 Forbidden): {results['403']} requests (After Radar ban enforced!)")
print("=" * 65)

# Inspect live Radar API on Node
print("\n>>> Querying Node Daemon Radar State...")
try:
    resp = requests.get(NODE_RADAR_API, headers={"Authorization": f"Bearer {NODE_TOKEN}"}, timeout=4)
    data = resp.json()
    bans = data.get("stats", {}).get("activeBansList", [])
    
    print(f"  Active Bans Count: {len(bans)}")
    for b in bans:
        if b.get("ip") == ATTACKER_IP:
            print(f"\n  [!] THREAT QUARANTINED ON NODE:")
            print(f"      IP:       {b.get('ip')} (Country: {b.get('country')})")
            print(f"      Reason:   {b.get('reason')}")
            print(f"      Duration: 15 minutes (auto-expires)")
except Exception as err:
    print(f"  Could not reach Radar API: {err}")

print("\nDone! View live threat table on http://localhost:3000/radar")
