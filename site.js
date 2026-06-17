function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAwardLevel(award) {
  const text = normalize(award);
  if (/一等奖|一等|gold|first|金奖/.test(text)) return 1;
  if (/二等奖|二等|silver|second|银奖|银牌/.test(text)) return 2;
  if (/三等奖|三等|bronze|third|铜奖|铜牌/.test(text)) return 3;
  return 0;
}

function getRatingLevel(row) {
  var contest = String(row.contest || "");
  var award = String(row.award || "");
  var rank = Number(row.rank || 99999);
  var isPrimary = contest.indexOf("小学组") >= 0;
  var isMiddle = contest.indexOf("初中组") >= 0;
  var isAPIO = contest.indexOf("APIO") >= 0;
  var isWC = contest.indexOf("WC") >= 0 || /冬季/.test(contest);
  var isNOIP = contest.indexOf("NOIP") >= 0;
  if (isAPIO || isWC) {
    if (/银牌/.test(award)) return 9;
    if (/铜牌/.test(award)) return 8;
  }
  if (isNOIP) {
    if (rank <= 20) return 7;
    if (/一等奖/.test(award)) return 6;
    if (/二等奖/.test(award)) return 5;
    if (/三等奖/.test(award)) return 4;
  }
  if (isPrimary) {
    if (rank <= 20) return 4;
    if (/一等奖/.test(award)) return 3;
    if (/二等奖/.test(award)) return 2;
    if (/三等奖/.test(award)) return 1;
  }
  if (isMiddle) {
    if (rank <= 20) return 5;
    if (/一等奖/.test(award)) return 4;
    if (/二等奖/.test(award)) return 3;
    if (/三等奖/.test(award)) return 2;
  }
  return 0;
}


function contestNameOf(row) {
  return String(row?.contest ?? row?.contestName ?? row?.match ?? "").trim();
}

function setActiveNav() {
  const page = document.body.dataset.page;
  const navKey = page === "contest-detail" ? "contests" : page === "player-detail" ? "players" : page === "school-detail" ? "schools" : page;
  document.querySelectorAll("[data-nav]").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === navKey);
  });
}

function renderEmpty(tbody, colspan, text) {
  tbody.innerHTML = "<tr><td class=\"empty\" colspan=\"" + colspan + "\">" + escapeHtml(text) + "</td></tr>";
}

async function loadResults() {
  const response = await fetch("./data/results.json");
  if (!response.ok) throw new Error("Load results.json failed: " + response.status);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function loadSchoolTeams() {
  try {
    const response = await fetch("./data/school_teams.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadAnnouncements() {
  try {
    const response = await fetch("./data/announcements/index.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function buildPlayerStats(rows, merges) {
  var map = new Map();
  rows.forEach(function(row) {
    var school = String(row.school || "");
    var keySchool = school;
    if (merges && merges.length) {
      merges.forEach(function(m) {
        var allMs = [];
        if (m.schools) { if (m.schools.high) allMs.push(m.schools.high); if (m.schools.middle) allMs.push(m.schools.middle); if (m.schools.primary) allMs.push(m.schools.primary); }
        if (m.merged_schools) allMs = allMs.concat(m.merged_schools);
        if (!m.schools && m.canonical_school) allMs.push(m.canonical_school);
        if (row.name === m.name && allMs.indexOf(school) >= 0) {
          keySchool = (m.schools && (m.schools["high"] || m.schools["middle"] || m.schools["primary"])) || m.canonical_school || school;
        }
      });
    }
    var key = (row.name || "") + "__" + keySchool;
    if (!map.has(key)) {
      map.set(key, { name: String(row.name || ""), school: keySchool, first: 0, second: 0, third: 0, total: 0, rating: 0 });
    }
    const item = map.get(key);
    // Compute rating from ALL records including CCF
    const rlv = getRatingLevel(row);
    if (rlv > item.rating) item.rating = rlv;
    // Skip CCF competitions from award counting
    if (row.contest && row.contest.indexOf('年合肥市赛') < 0) return;
    const lv = getAwardLevel(row.award);
    if (lv === 1) item.first += 1;
    if (lv === 2) item.second += 1;
    if (lv === 3) item.third += 1;
    item.total += 1;
  });
  return [...map.values()].sort(function(a, b) {
    if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
    if (b.first !== a.first) return b.first - a.first;
    if (b.second !== a.second) return b.second - a.second;
    if (b.third !== a.third) return b.third - a.third;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function buildContestStats(rows) {
  const map = new Map();
  rows.forEach(function(row) {
    var key = contestNameOf(row);
    if (!key) return;
    if (!map.has(key)) map.set(key, { name: key, first: 0, second: 0, third: 0, total: 0 });
    var item = map.get(key);
    var lv = getAwardLevel(row.award);
    if (lv === 1) item.first += 1;
    if (lv === 2) item.second += 1;
    if (lv === 3) item.third += 1;
    item.total += 1;
  });
  return [...map.values()].sort(function(a, b) {
    var yearA = parseInt(a.name, 10) || 0;
    var yearB = parseInt(b.name, 10) || 0;
    if (yearB !== yearA) return yearB - yearA;
    var isPriA = a.name.indexOf("??") >= 0 ? 0 : 1;
    var isPriB = b.name.indexOf("??") >= 0 ? 0 : 1;
    if (isPriA !== isPriB) return isPriA - isPriB;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function getSchoolLevel(school) {
  var s = normalize(school);
  if (s.indexOf("中学") !== -1 || s.indexOf("初中") !== -1 || s.indexOf("中") !== -1 && (s.indexOf("一中") !== -1 || s.indexOf("二中") !== -1 || s.indexOf("三中") !== -1 || s.indexOf("四中") !== -1 || s.indexOf("五中") !== -1 || s.indexOf("六中") !== -1 || s.indexOf("七中") !== -1 || s.indexOf("八中") !== -1 || s.indexOf("九中") !== -1 || s.indexOf("十中") !== -1)) {
    return "middle";
  }
  if (s.indexOf("小学") !== -1) {
    return "primary";
  }
  if (s.indexOf("学校") !== -1) {
    if (s.indexOf("实验") !== -1) return "middle";
    return "primary";
  }
  return "primary";
}

function buildSchoolStats(rows, teamRows) {
  var map = new Map();
  rows.forEach(function(row) {
    var school = String(row.school || "");
    if (!school) return;
    var c = String(row.contest || "").trim();
    var level = c.indexOf("小学") >= 0 ? "primary" : c.indexOf("初中") >= 0 ? "middle" : getSchoolLevel(school);
    var key = school + "__" + level;
    if (!map.has(key)) {
      map.set(key, { school: school, level: level, teamFirst: 0, teamSecond: 0, teamThird: 0, first: 0, second: 0, third: 0, total: 0 });
    }
    var item = map.get(key);
    var lv = getAwardLevel(row.award);
    if (lv === 1) item.first += 1;
    if (lv === 2) item.second += 1;
    if (lv === 3) item.third += 1;
    item.total += 1;
  });
  teamRows.forEach(function(row) {
    var school = String(row.school || "");
    if (!school) return;
    var teamLevel = String(row.level || "both");
    map.forEach(function(item, key) {
      if (key.indexOf(school + "__") === 0 && (teamLevel === "both" || item.level === teamLevel)) {
        item.teamFirst += Number(row.teamFirst || 0);
        item.teamSecond += Number(row.teamSecond || 0);
        item.teamThird += Number(row.teamThird || 0);
      }
    });
    var found = false;
    map.forEach(function(item, key) { if (key.indexOf(school + "__") === 0 && (teamLevel === "both" || item.level === teamLevel)) found = true; });
    if (!found) {
      if (teamLevel === "both" || teamLevel === "primary") {
        map.set(school + "__primary", { school: school, level: "primary", teamFirst: Number(row.teamFirst || 0), teamSecond: Number(row.teamSecond || 0), teamThird: Number(row.teamThird || 0), first: 0, second: 0, third: 0, total: 0 });
      }
      if (teamLevel === "both" || teamLevel === "middle") {
        map.set(school + "__middle", { school: school, level: "middle", teamFirst: Number(row.teamFirst || 0), teamSecond: Number(row.teamSecond || 0), teamThird: Number(row.teamThird || 0), first: 0, second: 0, third: 0, total: 0 });
      }
    }
  });
  return [...map.values()].sort(function(a, b) {
    if (b.teamFirst !== a.teamFirst) return b.teamFirst - a.teamFirst;
    if (b.teamSecond !== a.teamSecond) return b.teamSecond - a.teamSecond;
    if (b.teamThird !== a.teamThird) return b.teamThird - a.teamThird;
    if (b.first !== a.first) return b.first - a.first;
    if (b.second !== a.second) return b.second - a.second;
    if (b.third !== a.third) return b.third - a.third;
    return a.school.localeCompare(b.school, "zh-CN");
  });
}

// ===== Calendar =====
function renderCalendar() {
  var container = document.getElementById("calendarDays");
  if (!container) return;
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var today = now.getDate();

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var daysInPrev = new Date(year, month, 0).getDate();

  var label = document.querySelector(".calendar-month-label");
  if (label) label.textContent = year + " 年 " + (month + 1) + " 月";

  var cells = "";
  for (var i = 0; i < firstDay; i++) {
    cells += '<span class="calendar-day other-month">' + (daysInPrev - firstDay + i + 1) + '</span>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    cells += '<span class="calendar-day' + (d === today ? " today" : "") + '">' + d + '</span>';
  }
  var remaining = 42 - (firstDay + daysInMonth);
  for (var r = 1; r <= remaining && r <= 14; r++) {
    cells += '<span class="calendar-day other-month">' + r + '</span>';
  }
  container.innerHTML = cells;
}

// ===== Homepage =====
function renderHome(rows, teamRows, announcements, merges) {
  var summary = document.getElementById("homeSummary");
  var rankBody = document.getElementById("homeSchoolRankBody");
  if (!rankBody) return;

  var players = buildPlayerStats(rows, merges);
  var contests = buildContestStats(rows);
  var schools = buildSchoolStats(rows, teamRows);

  // Stats cards
  var elStudents = document.getElementById("statStudents");
  var elSchools = document.getElementById("statSchools");
  var elContests = document.getElementById("statContests");
  if (elStudents) elStudents.textContent = players.length;
  if (elSchools) elSchools.textContent = schools.length;
  if (elContests) elContests.textContent = contests.length;

  // Notices
  var noticeList = document.getElementById("noticeList");
  if (noticeList && announcements && announcements.length) {
    noticeList.innerHTML = announcements.slice(0, 5).map(function(a) {
      var dateStr = a.date ? '<span class="notice-date">' + escapeHtml(a.date) + '</span>' : "";
      var summary = a.summary ? escapeHtml(a.summary) : "";
      return '<div class="notice-item"><div class="notice-title"><a class="notice-link" href="./hfoi-announcement-detail?id=' + encodeURIComponent(a.id) + '">' + escapeHtml(a.title) + '</a></div>' + dateStr + '<p class="notice-content">' + summary + '</p></div>';
    }).join("");
  }

  // Calendar
  renderCalendar();

  // Tab switching
  var currentLevel = "primary";
  var tabGroup = document.getElementById("schoolTabGroup");
  if (tabGroup) {
    tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentLevel = btn.getAttribute("data-level");
        paintSchools(currentLevel);
      });
    });
  }

  function paintSchools(level) {
    var filtered = schools.filter(function(s) { return s.level === level; }); var list = filtered.slice(0, 10);
    if (!list.length) {
      renderEmpty(rankBody, 9, "暂无数据");
      if (summary) summary.textContent = "共 0 所学校";
      return;
    }
    rankBody.innerHTML = list.map(function(row, idx) {
      return '<tr><td>' + (idx + 1) + '</td><td><a class="table-link" href="./hfoi-school-detail?school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.school) + '</a></td><td>' + row.teamFirst + '</td><td>' + row.teamSecond + '</td><td>' + row.teamThird + '</td><td>' + row.first + '</td><td>' + row.second + '</td><td>' + row.third + '</td><td>' + (row.first + row.second + row.third) + '</td></tr>';
    }).join("");
    if (summary) summary.textContent = "共 " + list.length + " 所学校";
  }

  paintSchools(currentLevel);
}

// ===== Players Page =====
function renderPlayers(rows, merges, pinyin) {
  var input = document.getElementById("playerSearchInput");
  var summary = document.getElementById("playersSummary");
  var tbody = document.getElementById("playersBody");
  var pagination = document.getElementById("playersPagination");
  var tableWrap = document.getElementById("playersTableWrap");
  var tabGroup = document.getElementById("playerTabGroup");
  if (!input || !summary || !tbody) return;

  var PAGE_SIZE = 50;
  var currentLevel = "all";
  var currentRows = rows;
  var currentList = [];

  function filterByLevel(level, data) {
    if (level === "all") return data;
    var isPrimary = level === "primary";
    return data.filter(function(r) {
      var c = String(r.contest || "").trim();
      return isPrimary ? c.indexOf("小学") >= 0 : c.indexOf("初中") >= 0;
    });
  }

  function paint(list, page) {
    var keyword = normalize(input.value);

    if (tableWrap) tableWrap.style.display = "";
    if (pagination) pagination.style.display = "";

    currentList = list;
    if (!page || page < 1) page = 1;
    var totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, list.length);
    var pageItems = list.slice(start, end);
    if (!list.length) {
      renderEmpty(tbody, 7, "No matched players");
      summary.textContent = "共 0 名选手";
      if (pagination) pagination.innerHTML = "";
      return;
    }
    tbody.innerHTML = pageItems.map(function(row, idx) {
      var rank = start + idx + 1;
      return "<tr><td>" + rank + "</td><td>" + "<a class=\"table-link\" href=\"./hfoi-player-detail?name=" + encodeURIComponent(row.name) + "&school=" + encodeURIComponent(row.school) + "\">" + escapeHtml(row.name) + "</a></td><td>" + escapeHtml(row.school) + "</td><td>" + row.first + "</td><td>" + row.second + "</td><td>" + row.third + "</td><td>" + row.total + "</td><td>" + String(row.rating || 0) + "</td></tr>";
    }).join("");
    summary.textContent = "第 " + page + " / " + totalPages + " 页 | 共 " + list.length + " 名选手";
    if (pagination) {
      var html = "";
      if (page > 1) html += "<button class=\"page-btn\" data-page=\"" + (page - 1) + "\">上一页</button>";
      for (var p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
        html += "<button class=\"page-btn" + (p === page ? " active" : "") + "\" data-page=\"" + p + "\">" + p + "</button>";
      }
      if (page < totalPages) html += "<button class=\"page-btn\" data-page=\"" + (page + 1) + "\">下一页</button>";
      pagination.innerHTML = html;
      pagination.querySelectorAll(".page-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var p = parseInt(this.getAttribute("data-page"));
          paint(currentList, p);
        });
      });
    }
  }

  function refresh() {
    var keyword = normalize(input.value);
    currentRows = filterByLevel(currentLevel, rows);
    var levelRows = currentRows;
    var searchRows = keyword ? levelRows.filter(function(r) {
      var normalMatch = normalize(r.name + " " + r.school).indexOf(keyword) !== -1;
      if (normalMatch) return true;
      if (pinyin && pinyin[r.name]) {
        var py = pinyin[r.name];
        if (normalize(py.full).indexOf(keyword) >= 0 || normalize(py.short).indexOf(keyword) >= 0) return true;
      }
      return false;
    }) : levelRows;
    paint(buildPlayerStats(searchRows.length ? searchRows : levelRows, merges), 1);
  }

  if (tabGroup) {
    tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentLevel = btn.getAttribute("data-level");
        input.value = "";
        refresh();
      });
    });
  }

  input.addEventListener("input", function() { refresh(); });
  paint(buildPlayerStats(currentRows, merges), 1);
}
// ===== Schools Page =====
function renderSchools(rows, teamRows) {
  var input = document.getElementById("schoolSearchInput");
  var summary = document.getElementById("schoolsSummary");
  var tbody = document.getElementById("schoolsBody");
  var pagination = document.getElementById("schoolsPagination");
  var tabGroup = document.getElementById("schoolTabGroupPage");
  if (!input || !summary || !tbody) return;

  var PAGE_SIZE = 30;
  var all = buildSchoolStats(rows, teamRows);
  var currentLevel = "primary";
  var currentList = [];

  function paint(list, page) {
    currentList = list;
    if (!page || page < 1) page = 1;
    var totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, list.length);
    var pageItems = list.slice(start, end);

    if (!list.length) {
      renderEmpty(tbody, 9, "No matched schools");
      summary.textContent = "Total 0 schools";
      if (pagination) pagination.innerHTML = "";
      return;
    }
    tbody.innerHTML = pageItems.map(function(row, idx) {
      var rank = start + idx + 1;
      return "<tr><td>" + rank + "</td><td><a class=\"table-link\" href=\"./hfoi-school-detail?school=" + encodeURIComponent(row.school) + "\">" + escapeHtml(row.school) + "</a></td><td>" + row.teamFirst + "</td><td>" + row.teamSecond + "</td><td>" + row.teamThird + "</td><td>" + row.first + "</td><td>" + row.second + "</td><td>" + row.third + "</td><td>" + row.total + "</td></tr>";
    }).join("");
    summary.textContent = "第 " + page + " / " + totalPages + " 页 | 共 " + list.length + " 所学校";
    if (pagination) {
      var html = "";
      if (page > 1) html += "<button class=\"page-btn\" data-page=\"" + (page - 1) + "\">上一页</button>";
      for (var p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
        html += "<button class=\"page-btn" + (p === page ? " active" : "") + "\" data-page=\"" + p + "\">" + p + "</button>";
      }
      if (page < totalPages) html += "<button class=\"page-btn\" data-page=\"" + (page + 1) + "\">下一页</button>";
      pagination.innerHTML = html;
      pagination.querySelectorAll(".page-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
          paint(currentList, parseInt(this.getAttribute("data-page")));
        });
      });
    }
  }

  function filterAndPaint(level) {
    currentLevel = level;
    paint(all.filter(function(s) { return s.level === level; }), 1);
  }

  if (tabGroup) {
    tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        filterAndPaint(btn.getAttribute("data-level"));
        input.value = "";
      });
    });
  }

  function applyFilter() {
    var keyword = normalize(input.value);
    var base = all.filter(function(s) { return s.level === currentLevel; });
    paint(keyword ? base.filter(function(row) { return normalize(row.school).indexOf(keyword) !== -1; }) : base, 1);
  }

  input.addEventListener("input", applyFilter);
  filterAndPaint("primary");
}
// ===== Contests Page =====
function renderContests(rows) {
  var input = document.getElementById("contestSearchInput");
  var summary = document.getElementById("contestsSummary");
  var tbody = document.getElementById("contestsBody");
  var tabType = document.getElementById("contestTabType");
  if (!input || !summary || !tbody) return;

  var all = buildContestStats(rows);
  var currentType = "hefei";

  function paint(list) {
    var filtered = list.filter(function(c) {
      return currentType === "hefei" ? c.name.indexOf("年合肥市赛") >= 0 : c.name.indexOf("年合肥市赛") < 0;
    });
    if (!filtered.length) {
      renderEmpty(tbody, 6, "暂无比赛数据");
      summary.textContent = "Total 0 contests";
      return;
    }
    tbody.innerHTML = filtered.map(function(row, idx) {
      return "<tr><td>" + (idx + 1) + "</td><td><a class=\"table-link contest-link\" data-contest-name=\"" + escapeHtml(row.name) + "\" href=\"./hfoi-contest-detail?name=" + encodeURIComponent(row.name) + "\">" + escapeHtml(row.name) + "</a></td><td>" + row.first + "</td><td>" + row.second + "</td><td>" + row.third + "</td><td>" + row.total + "</td></tr>";
    }).join("");
    summary.textContent = "Total " + filtered.length + " contests";

    document.querySelectorAll(".contest-link").forEach(function(a) {
      a.addEventListener("click", function() {
        var name = a.getAttribute("data-contest-name") || "";
        localStorage.setItem("last_contest_name", name);
      });
    });
  }

  if (tabType) {
    tabType.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabType.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentType = btn.getAttribute("data-type");
        applyFilter();
      });
    });
  }

  function applyFilter() {
    var keyword = normalize(input.value);
    var base = currentType === "hefei" ? all.filter(function(c) { return c.name.indexOf("年合肥市赛") >= 0; }) : all.filter(function(c) { return c.name.indexOf("年合肥市赛") < 0; });
    paint(keyword ? base.filter(function(row) { return normalize(row.name).indexOf(keyword) !== -1; }) : base);
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
}
// ===== Contest Detail Page =====
function renderContestDetail(rows, teamRows) {
  var title = document.getElementById("detailTitle");
  var tabGroup = document.getElementById("contestDetailTabGroup");
  var playerPanel = document.getElementById("contestPlayersPanel");
  var schoolPanel = document.getElementById("contestSchoolsPanel");
  var summary = document.getElementById("detailSummary");
  var tbody = document.getElementById("detailBody");
  var schoolSummary = document.getElementById("schoolAwardSummary");
  var schoolTbody = document.getElementById("schoolAwardBody");
  if (!title || !summary || !tbody) return;

  var params = new URLSearchParams(window.location.search);
  var fromUrl = String(params.get("name") || params.get("contest") || "").trim();
  var fromStorage = String(localStorage.getItem("last_contest_name") || "").trim();
  var contestName = fromUrl || fromStorage;

  var uniqueContests = [...new Set(rows.map(contestNameOf).filter(Boolean))];
  if (!contestName && uniqueContests.length === 1) contestName = uniqueContests[0];

  title.textContent = contestName ? "比赛详情: " + contestName : "比赛详情";

  if (!contestName) {
    renderEmpty(tbody, 5, "Missing contest name");
    summary.textContent = "请从比赛列表进入";
    if (schoolSummary) schoolSummary.textContent = "";
    if (schoolTbody) renderEmpty(schoolTbody, 5, "");
    return;
  }

  function compact(text) { return normalize(text).replace(/\s+/g, ""); }
  var target = compact(contestName);
  var list = rows.filter(function(row) { return compact(contestNameOf(row)) === target; });
  if (list.length === 0) {
    list = rows.filter(function(row) { return normalize(contestNameOf(row)).indexOf(normalize(contestName)) !== -1; });
  }

  list.sort(function(a, b) {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return Number(a.rank || 99999) - Number(b.rank || 99999);
  });

  // ===== Render Players Tab =====
  function renderPlayers() {
    if (!list.length) {
      renderEmpty(tbody, 5, "暂无排名记录");
      summary.textContent = "共 0 条记录";
      return;
    }
    // Show player rating (after merge)
  var ratingEl = document.getElementById("playerDetailRating");
  if (ratingEl) {
    var maxRating = 0;
    list.forEach(function(r) { var rlv = getRatingLevel(r); if (rlv > maxRating) maxRating = rlv; });
    ratingEl.textContent = maxRating > 0 ? maxRating + " 级" : "-";
  }

  tbody.innerHTML = list.map(function(row) {
      return '<tr><td>' + escapeHtml(row.rank) + '</td><td>' + '<a class="table-link" href="./hfoi-player-detail?name=' + encodeURIComponent(row.name) + '&school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.name) + '</a></td><td>' + '<a class="table-link" href="./hfoi-school-detail?school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.school) + '</a></td><td>' + escapeHtml(row.award) + '</td><td>' + escapeHtml(row.year) + '</td></tr>';
    }).join("");
    summary.textContent = "共 " + list.length + " 条记录";
  }

  // ===== Render Schools Tab =====
    function renderSchoolsTab() {
    if (!schoolSummary || !schoolTbody) return;

    // Filter teamRows by matching contest name
    var target = compact(contestName);
    var filteredTeams = [];
    if (teamRows && teamRows.length) {
      teamRows.forEach(function(tr) {
        var tc = String(tr.contest || "");
        // If no contest field, apply to all; otherwise match by compact
        if (!tc || compact(tc) === target) {
          filteredTeams.push(tr);
        }
      });
    }

    // Build school list directly from filtered team rows (PDF data)
    var schoolList = [];
    filteredTeams.forEach(function(tr) {
      var s = String(tr.school || "");
      if (!s) return;
      schoolList.push({
        school: s,
        teamFirst: Number(tr.teamFirst || 0),
        teamSecond: Number(tr.teamSecond || 0),
        teamThird: Number(tr.teamThird || 0),
        pos: Number(tr.pos || 999)
      });
    });

    schoolList.sort(function(a, b) {
      return (a.pos || 999) - (b.pos || 999);
    });

    if (schoolList.length === 0) {
      renderEmpty(schoolTbody, 5, "暂无学校数据");
      schoolSummary.textContent = "共 0 所学校";
      return;
    }

    schoolTbody.innerHTML = schoolList.map(function(s, idx) {
      return '<tr><td>' + (idx + 1) + '</td><td><a class=\"table-link\" href=\"./hfoi-school-detail?school=' + encodeURIComponent(s.school) + '\">' + escapeHtml(s.school) + '</a></td><td>' + s.teamFirst + '</td><td>' + s.teamSecond + '</td><td>' + s.teamThird + '</td></tr>';
    }).join("");
    schoolSummary.textContent = "共 " + schoolList.length + " 所学校";
  }  // ===== Tab Switching =====
  var panels = {};
  document.querySelectorAll('[id$="Panel"]').forEach(function(p) { panels[p.id] = p; });
  var allPanels = document.getElementById("contestPlayersPanel") && document.getElementById("contestSchoolsPanel");

  function switchTab(tab) {
    if (tabGroup) {
      tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      var btn = tabGroup.querySelector('[data-tab="' + tab + '"]');
      if (btn) btn.classList.add("active");
    }
    if (playerPanel) playerPanel.style.display = tab === "players" ? "" : "none";
    if (schoolPanel) schoolPanel.style.display = tab === "schools" ? "" : "none";
    if (tab === "players") renderPlayers();
    if (tab === "schools") renderSchoolsTab();
  }

  if (tabGroup) {
    tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        switchTab(btn.getAttribute("data-tab"));
      });
    });
  }

  // Default: show players tab
  switchTab("players");
}
// ===== Player Detail =====
function renderPlayerDetail(rows, profiles, merges) {
  var title = document.getElementById("playerDetailTitle");
  var summary = document.getElementById("playerDetailSummary");
  var tbody = document.getElementById("playerDetailBody");
  if (!title || !summary || !tbody) return;

  var params = new URLSearchParams(window.location.search);
  var name = String(params.get("name") || "").trim();
  var school = String(params.get("school") || "").trim();

  if (!name) {
    renderEmpty(tbody, 4, "Missing player name");
    summary.textContent = "请从选手列表进入";
    return;
  }

  var n = function(v) { return String(v || "").trim().toLowerCase(); };
  var list = rows.filter(function(row) {
    var matchName = n(row.name) === n(name);
    if (school) return matchName && n(row.school).indexOf(n(school)) !== -1;
    return matchName;
  });

  if (!list.length) {
    renderEmpty(tbody, 4, "暂无该选手记录");
    summary.textContent = "共 0 条记录";
    return;
  }

    title.textContent = list[0].name;

  // Show player profile if available
  var profilePanel = document.getElementById("playerProfilePanel");
  if (profilePanel && profiles && profiles.length) {
    var playerId = String(list[0].id || "");
    var found = false;
    profiles.forEach(function(p) {
      if (String(p.id || "") === playerId) {
        found = true;
        var elLuogu = document.getElementById("profileLuogu");
        var elCF = document.getElementById("profileCF");
        var elAtCoder = document.getElementById("profileAtCoder");
        if (elLuogu) elLuogu.innerHTML = p.luogu ? '<a class="table-link" href="https://www.luogu.com.cn/user/' + encodeURIComponent(p.luogu) + '" target="_blank" rel="noopener">' + escapeHtml(p.luogu) + '</a>' : "-";
        if (elCF) elCF.innerHTML = p.codeforces ? '<a class="table-link" href="https://codeforces.com/profile/' + encodeURIComponent(p.codeforces) + '" target="_blank" rel="noopener">' + escapeHtml(p.codeforces) + '</a>' : "-";
        if (elAtCoder) elAtCoder.innerHTML = p.atcoder ? '<a class="table-link" href="https://atcoder.jp/users/' + encodeURIComponent(p.atcoder) + '" target="_blank" rel="noopener">' + escapeHtml(p.atcoder) + '</a>' : "-";
      }
    });
    profilePanel.style.display = found ? "" : "none";
  }

  list.sort(function(a, b) {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return Number(a.rank || 99999) - Number(b.rank || 99999);
  });

  // Apply merge: include records from merged schools
  if (merges && merges.length) {
    merges.forEach(function(m) {
      if (n(m.name) === n(name)) {
        var allMs = [];
        if (m.schools) { if (m.schools.high) allMs.push(m.schools.high); if (m.schools.middle) allMs.push(m.schools.middle); if (m.schools.primary) allMs.push(m.schools.primary); }
        if (m.merged_schools) allMs = allMs.concat(m.merged_schools);
        if (!m.schools && m.canonical_school) allMs.push(m.canonical_school);
        allMs.forEach(function(ms) {
          rows.forEach(function(row) {
            if (n(row.name) === n(name) && n(String(row.school || "")) === n(ms)) {
              if (!list.some(function(l) { return l.id === row.id; })) { list.push(row); }
            }
          });
        });
      }
    });
    list.sort(function(a, b) { if ((b.year||0)!==(a.year||0)) return (b.year||0)-(a.year||0); return Number(a.rank||99999)-Number(b.rank||99999); });
  }

  // Show player rating (after merge)
  var ratingEl = document.getElementById("playerDetailRating");
  if (ratingEl) {
    var maxRating = 0;
    list.forEach(function(r) { var rlv = getRatingLevel(r); if (rlv > maxRating) maxRating = rlv; });
    ratingEl.textContent = maxRating > 0 ? maxRating + " 级" : "-";
  }

  tbody.innerHTML = list.map(function(row) {
    var cname = contestNameOf(row);
    var contestLink = '<a class="table-link" href="./hfoi-contest-detail?name=' + encodeURIComponent(cname) + '">' + escapeHtml(cname) + '</a>';
    return '<tr><td>' + contestLink + '</td><td>' + escapeHtml(row.school) + '</td><td>' + escapeHtml(row.award) + '</td><td>' + escapeHtml(row.rank) + '</td></tr>';
  }).join("");
  summary.textContent = "共 " + list.length + " 条记录";
}
// ===== School Detail =====
function renderSchoolDetail(rows, teamRows) {
  var title = document.getElementById("schoolDetailTitle");
  var summary = document.getElementById("schoolDetailSummary");
  var tbody = document.getElementById("schoolDetailBody");
  var tabGroup = document.getElementById("schoolDetailTabGroup");
  if (!title || !summary || !tbody) return;

  var params = new URLSearchParams(window.location.search);
  var school = String(params.get("school") || "").trim();

  if (!school) {
    renderEmpty(tbody, 7, "Missing school name");
    summary.textContent = "请从学校列表进入";
    return;
  }

  title.textContent = "学校详情: " + school;

  var n = function(v) { return String(v || "").trim().toLowerCase(); };
  var ns = n(school);
  var list = rows.filter(function(row) { return n(row.school) === ns; });

  if (!list.length) {
    renderEmpty(tbody, 7, "暂无该学校记录");
    summary.textContent = "共 0 场比赛";
    return;
  }

  // Group by contest, count individual awards per contest
  var contestMap = new Map();
  list.forEach(function(row) {
    var cname = contestNameOf(row);
    if (!cname) return;
    if (!contestMap.has(cname)) {
      contestMap.set(cname, { contest: cname, teamFirst: 0, teamSecond: 0, teamThird: 0, first: 0, second: 0, third: 0 });
    }
    var item = contestMap.get(cname);
    var lv = getAwardLevel(row.award);
    if (lv === 1) item.first += 1;
    if (lv === 2) item.second += 1;
    if (lv === 3) item.third += 1;
  });

  // Cross-reference team awards from school_teams.json (match by contest + school)
  contestMap.forEach(function(item, cname) {
    if (teamRows && teamRows.length) {
      var cn = normalize(item.contest);
      teamRows.forEach(function(tr) {
        var trContest = String(tr.contest || "");
        if (normalize(trContest) === cn && normalize(String(tr.school || "")) === ns) {
          item.teamFirst = Number(tr.teamFirst || 0);
          item.teamSecond = Number(tr.teamSecond || 0);
          item.teamThird = Number(tr.teamThird || 0);
        }
      });
    }
  });

  var contestList = [...contestMap.values()].sort(function(a, b) {
    return a.contest.localeCompare(b.contest, "zh-CN");
  });

  var currentTab = "all";

  function paint() {
    var filtered = currentTab === "all" ? contestList : contestList.filter(function(item) {
      return currentTab === "primary" ? item.contest.indexOf("小学") >= 0 : item.contest.indexOf("初中") >= 0;
    });
    if (!filtered.length) {
      renderEmpty(tbody, 7, "暂无比赛数据");
      summary.textContent = "共 0 场比赛";
      return;
    }
    tbody.innerHTML = filtered.map(function(item) {
      var cname = item.contest;
      var contestLink = '<a class="table-link" href="./hfoi-contest-detail?name=' + encodeURIComponent(cname) + '">' + escapeHtml(cname) + '</a>';
      return '<tr><td>' + contestLink + '</td><td>' + item.teamFirst + '</td><td>' + item.teamSecond + '</td><td>' + item.teamThird + '</td><td>' + item.first + '</td><td>' + item.second + '</td><td>' + item.third + '</td></tr>';
    }).join("");
    summary.textContent = "共 " + filtered.length + " 场比赛";
  }

  if (tabGroup) {
    tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentTab = btn.getAttribute("data-tab");
        paint();
      });
    });
  }

  paint();
}

// ===== Init =====

async function loadPlayerProfiles() {
  try {
    const response = await fetch("./data/player_profiles.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadPlayerMerges() {
  var h = [{name:"黄乐逸",schools:{middle:"合肥一六八玫瑰园学校"},merged_schools:["合肥一六八玫瑰园学校西校区"]},{name:"吴一鸣",schools:{primary:"合肥市安庆路第三小学",middle:"合肥市第四十五中学"}}];
  try {
    const r = await fetch("./data/player_merges.json?v=" + Date.now());
    if (!r.ok) return h;
    const d = await r.json();
    return Array.isArray(d) && d.length ? d : h;
  } catch { return h; }
}

async function loadPinyin() {
  var h = {"黄乐逸":{"full":"huang le yi","short":"hly"},"吴一鸣":{"full":"wu yi ming","short":"wym"}};
  try {
    const r = await fetch("./data/pinyin.json?v=" + Date.now());
    if (!r.ok) return h;
    const d = await r.json();
    return (typeof d === "object" && !Array.isArray(d)) ? Object.assign({}, h, d) : h;
  } catch { return h; }
}

async function init() {
  setActiveNav();
  try {
    var rows, teamRows, profiles;
    var data = await Promise.all([loadResults(), loadSchoolTeams(), loadAnnouncements(), loadPlayerProfiles(), loadPlayerMerges(), loadPinyin()]);
    rows = data[0];
    teamRows = data[1];
    var announcements = data[2];
        profiles = data[3];
    var merges = data[4];
    var pinyin = data[5];
    var page = document.body.dataset.page;
    if (page === "home") renderHome(rows, teamRows, announcements, merges);
    if (page === "players") renderPlayers(rows, merges, pinyin);
    if (page === "schools") renderSchools(rows, teamRows);
    if (page === "contests") renderContests(rows);
    if (page === "contest-detail") renderContestDetail(rows, teamRows); if (page === "player-detail") renderPlayerDetail(rows, profiles, merges); if (page === "school-detail") renderSchoolDetail(rows, teamRows);
  } catch (error) {
    console.error(error);
    document.querySelectorAll("tbody").forEach(function(tbody) { renderEmpty(tbody, 10, "数据加载失败"); });
    document.querySelectorAll(".summary").forEach(function(node) { node.textContent = "数据文件加载失败"; });
  }
}

init();
