#!/usr/bin/env python3
"""
Rubber Panel — Traffic Radar Abuse & Threshold Tester
Simulates rapid concurrent connection flood to test:
 - 20 connections / 10-second sliding window limit
 - Automatic DDoS mitigation & iptables DROP
 - Radar telemetry in Admin & User panels
"""

import socket
import time
import threading
import sys

# Force UTF-8 stdout if supported
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

TARGET_HOST = "192.168.1.3"
TARGET_PORT = 25645
TOTAL_CONNECTIONS = 100  # Threshold is 20 in 10s -> 35 will breach threshold
HOLD_DURATION = 4       # Keep sockets open so ss/netstat detects established state

results = {"success": 0, "failed": 0, "blocked": 0}
lock = threading.Lock()

def simulate_connection(conn_id):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3.0)
        start = time.time()
        s.connect((TARGET_HOST, TARGET_PORT))
        
        # Send Minecraft handshake / legacy ping byte
        try:
            s.sendall(b"\xfe\x01")
        except Exception:
            pass

        with lock:
            results["success"] += 1
            print(f"[{conn_id:02d}] [OK] Connected successfully ({time.time() - start:.3f}s)")

        # Hold connection so the connection scanner records it in the sliding window
        time.sleep(HOLD_DURATION)
        try:
            s.close()
        except Exception:
            pass

    except socket.timeout:
        with lock:
            results["blocked"] += 1
            print(f"[{conn_id:02d}] [BLOCKED] TIMEOUT (Dropped by Rubber Radar iptables DROP)")
    except ConnectionRefusedError:
        with lock:
            results["failed"] += 1
            print(f"[{conn_id:02d}] [REFUSED] Connection refused")
    except Exception as e:
        with lock:
            results["failed"] += 1
            print(f"[{conn_id:02d}] [ERROR] {e}")

def main():
    global TARGET_HOST, TARGET_PORT
    if len(sys.argv) > 1:
        TARGET_HOST = sys.argv[1]
    if len(sys.argv) > 2:
        TARGET_PORT = int(sys.argv[2])

    print("=" * 60)
    print("  Rubber Radar Abuse & Rate Limit Test Tool")
    print(f"  Target: {TARGET_HOST}:{TARGET_PORT}")
    print(f"  Total Requests: {TOTAL_CONNECTIONS} (Threshold: 20 conns in 10s)")
    print("  Firing rapid concurrent burst...")
    print("=" * 60)

    threads = []
    start_time = time.time()

    for i in range(1, TOTAL_CONNECTIONS + 1):
        t = threading.Thread(target=simulate_connection, args=(i,))
        threads.append(t)
        t.start()
        time.sleep(0.08)  # 80ms delay between launches (~12 conns/sec burst)

    for t in threads:
        t.join()

    duration = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"  Test Completed in {duration:.2f}s")
    print(f"  [OK] Connected: {results['success']}")
    print(f"  [BLOCKED] Dropped (iptables): {results['blocked']}")
    print(f"  [OTHER] Failed/Refused: {results['failed']}")
    print("=" * 60)
    print(">> Open your Admin Panel (/radar) and User Panel Network tab")
    print("   to see the real-time Traffic spike and Offender IP listing!")

if __name__ == "__main__":
    main()
