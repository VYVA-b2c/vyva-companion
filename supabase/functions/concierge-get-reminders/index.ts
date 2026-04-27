import {
  encodeFilter,
  jsonResponse,
  requiredString,
  restRequest,
  routeTool,
} from "../_shared/concierge-tools.ts";

interface ReminderRow {
  id: string;
  reminder_type: string;
  title: string;
  description: string | null;
  reminder_date: string;
  reminder_time: string | null;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysUntil(dateString: string): number {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = new Date(`${dateString}T00:00:00.000Z`);
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

Deno.serve((req: Request) => routeTool(req, async (body) => {
  const userId = requiredString(body, "user_id")!;
  const rawDaysAhead = body.days_ahead;
  const daysAhead = typeof rawDaysAhead === "number" && Number.isFinite(rawDaysAhead)
    ? Math.max(0, Math.min(30, Math.round(rawDaysAhead)))
    : 2;

  const today = new Date();
  const future = new Date(today);
  future.setUTCDate(future.getUTCDate() + daysAhead);

  const result = await restRequest<ReminderRow[]>(
    "GET",
    `concierge_reminders?select=id,reminder_type,title,description,reminder_date,reminder_time&user_id=${encodeFilter(userId)}&is_active=eq.true&triggered=eq.false&reminder_date=gte.${isoDate(today)}&reminder_date=lte.${isoDate(future)}&order=reminder_date.asc`,
  );

  if (result.error) {
    return jsonResponse({ error: result.error }, 500);
  }

  const reminders = (result.data ?? []).map((reminder) => ({
    ...reminder,
    days_until: daysUntil(reminder.reminder_date),
  }));

  return jsonResponse({
    reminders,
    count: reminders.length,
  });
}));
