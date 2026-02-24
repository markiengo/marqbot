/**
 * Network API wrappers.
 */

export async function loadCourses(url = "/courses") {
  const res = await fetch(url, { cache: "no-store" });
  return await res.json();
}

export async function loadPrograms(url = "/programs") {
  const res = await fetch(url, { cache: "no-store" });
  return await res.json();
}

export async function postRecommend(payload, url = "/recommend") {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function postCanTake(payload, url = "/can-take") {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function postFeedback(payload, url = "/feedback") {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}
