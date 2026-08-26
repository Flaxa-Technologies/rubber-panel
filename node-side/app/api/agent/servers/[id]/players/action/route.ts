import { NextRequest, NextResponse } from "next/server";
import { sendCommand } from "@/lib/server-manager";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, player, reason } = body;

    if (!action || !player) {
      return NextResponse.json({ error: "Action and player name are required" }, { status: 400 });
    }

    const safePlayer = player.replace(/[^a-zA-Z0-9_]/g, "");
    if (!safePlayer) {
      return NextResponse.json({ error: "Invalid player username" }, { status: 400 });
    }

    let cmd = "";
    switch (action) {
      case "kick":
        cmd = `kick ${safePlayer} ${reason ? `"${reason.replace(/"/g, "")}"` : "Kicked by administrator"}`;
        break;
      case "ban":
        cmd = `ban ${safePlayer} ${reason ? `"${reason.replace(/"/g, "")}"` : "Banned by administrator"}`;
        break;
      case "unban":
        cmd = `pardon ${safePlayer}`;
        break;
      case "op":
        cmd = `op ${safePlayer}`;
        break;
      case "deop":
        cmd = `deop ${safePlayer}`;
        break;
      case "whitelist_add":
        cmd = `whitelist add ${safePlayer}`;
        break;
      case "whitelist_remove":
        cmd = `whitelist remove ${safePlayer}`;
        break;
      default:
        return NextResponse.json({ error: "Unknown player action" }, { status: 400 });
    }

    console.log(`[PlayerAction] Server ${id}: executing "${cmd}"`);
    await sendCommand(id, cmd);

    return NextResponse.json({
      success: true,
      action,
      player: safePlayer,
      commandExecuted: cmd,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to execute player action" }, { status: 500 });
  }
}
