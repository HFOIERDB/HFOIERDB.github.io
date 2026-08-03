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

// 把奖项归到"金/银/铜"3 档(NOI/APIO/WC 用金/银/铜,市赛/NOIP/CSP-S 用一/二/三等 → 类比金/银/铜)
function getMedalLevel(award) {
  const text = normalize(award);
  if (/金牌|金奖|gold|first|一等奖|一等/.test(text)) return "gold";
  if (/银牌|银奖|silver|second|二等奖|二等/.test(text)) return "silver";
  if (/铜牌|铜奖|bronze|third|三等奖|三等/.test(text)) return "bronze";
  return null;
}

function getContestWeight(contest) {
  if (contest.indexOf("省选") >= 0) return 0;
  if (contest.indexOf("APIO") >= 0 || contest.indexOf("WC") >= 0) return 0.8;
  if (contest.indexOf("NOIP") >= 0) return 0.6;
  if (contest.indexOf("NOI") >= 0) return 1.0;
  if (contest.indexOf("CSP-S") >= 0) return 0.5;
  if (contest.indexOf("CSP-J") >= 0) return 0.4;
  if (contest.indexOf("市赛初中组") >= 0) return 0.35;
  if (contest.indexOf("市赛小学组") >= 0) return 0.3;
  return 0;
}

function getRatingLevel(row, allRows) {
  var contest = String(row.contest || "");
  var award = String(row.award || "");
  var rank = Number(row.rank || 99999);
  var isPrimary = contest.indexOf("小学组") >= 0;
  var isMiddle = contest.indexOf("初中组") >= 0;
  var isAPIO = contest.indexOf("APIO") >= 0;
  var isNOI = contest.indexOf("NOI") >= 0 && contest.indexOf("NOIP") < 0;
  var isWC = contest.indexOf("WC") >= 0 || /冬季/.test(contest);
  var isCSP = contest.indexOf("CSP") >= 0;
  var isNOIP = contest.indexOf("NOIP") >= 0;
  if (row.name === "贾治辰") return 9;
  if (isAPIO || isWC) {
    if (/金牌/.test(award)) return 9;
    if (/银牌/.test(award)) return 8;
    if (/铜牌/.test(award)) return 7;
  }
  if (isNOI) {
    if (/金牌/.test(award)) return 10;
    if (/银牌/.test(award)) return 9;
    if (/铜牌/.test(award)) return 8;
  }
   if (isCSP) {
      if (contest.indexOf("CSP-J") >= 0) {
        if (rank <= 20) return 5;
        if (/一等奖/.test(award)) return 4;
        if (/二等奖/.test(award)) return 3;
        if (/三等奖/.test(award)) return 2;
      } else {
        if (rank <= 20) return 6;
        if (/一等奖/.test(award)) return 5;
        if (/二等奖/.test(award)) return 4;
        if (/三等奖/.test(award)) return 3;
      }
   }
  if (isNOIP) {
    if (rank <= 20 && /一等奖/.test(award)) return 7;
    if (/一等奖/.test(award)) return 6;
    if (/二等奖/.test(award)) return 5;
    if (/三等奖/.test(award)) return 4;
  }
  var isProv = contest.indexOf("省选") >= 0;
  if (isProv) {
    if (/A队/.test(award)) return 9;
    if (/B队/.test(award)) return 8;
    if (/E队/.test(award)) return 8;
    if (!award && allRows) {
      var lastBRank = 0;
      for (var ri = 0; ri < allRows.length; ri++) {
        var rr = allRows[ri];
        if (rr.contest === contest && /B队/.test(rr.award)) {
          if (Number(rr.rank) > lastBRank) lastBRank = Number(rr.rank);
        }
      }
      if (rank < lastBRank) return 8;
    }
    return 7;
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


var contestPriorityRules = null;

function getContestPriority(contest) {
  if (contestPriorityRules) {
    for (var i = 0; i < contestPriorityRules.length; i++) {
      if (contest.indexOf(contestPriorityRules[i].pattern) >= 0) {
        return contestPriorityRules[i].priority;
      }
    }
  }
  return 999;
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

// 学校名别名表:把 data/school_aliases.json 里写的别名都映射到规范名
// 例:{"安徽省合肥市第四十五中学": "合肥市第四十五中学"}
async function loadSchoolAliases() {
  try {
    const response = await fetch("./data/school_aliases.json");
    if (!response.ok) return {};
    const data = await response.json();
    return (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
  } catch {
    return {};
  }
}

function applySchoolAliases(rows, aliases) {
  if (!aliases || !Object.keys(aliases).length) return rows;
  // 把 alias key 转成 normalize 后的小写,做大小写不敏感匹配
  var normMap = {};
  Object.keys(aliases).forEach(function(k) {
    normMap[normalize(k)] = aliases[k];
  });
  rows.forEach(function(r) {
    if (!r.school) return;
    var norm = normalize(r.school);
    if (normMap[norm]) r.school = normMap[norm];
  });
  return rows;
}

function buildPlayerStats(rows, merges, level) {
  var map = new Map();
  var contestCounts = {};
  rows.forEach(function(row) {
    var cc = String(row.contest || "").trim();
    if (cc) { if (!contestCounts[cc]) contestCounts[cc] = 0; contestCounts[cc]++; }
  });
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
          var pref = level === "primary" ? ["primary","middle","high"] : level === "middle" ? ["middle","high","primary"] : ["high","middle","primary"];
          keySchool = (m.schools && (m.schools[pref[0]] || m.schools[pref[1]] || m.schools[pref[2]])) || m.canonical_school || school;
        }
      });
    }
    var key = (row.name || "") + "__" + keySchool;
    if (!map.has(key)) {
      map.set(key, { name: String(row.name || ""), school: keySchool, first: 0, second: 0, third: 0, total: 0, score: 0, maxScore: 0, rating: 0 });
    }
    const item = map.get(key);
    // Compute rating from ALL records including CCF
    const rlv = getRatingLevel(row, rows);
    if (rlv > item.rating) item.rating = rlv;
    

    var w = getContestWeight(String(row.contest || '').trim());
    if (w > 0) {
      var rk = Number(row.rank || 0);
      var tp = contestCounts[String(row.contest || '').trim()] || 0;
      if (rk > 0 && tp > 0) {
        var sc = Math.round(100 * (2 - Math.sqrt(rk / tp)) * w);
        item.score = (item.score || 0) + sc;
        if (sc > (item.maxScore || 0)) item.maxScore = sc;
      }
    }
    
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
    var oa = getContestPriority(a.name);
    var ob = getContestPriority(b.name);
    if (oa !== ob) return oa - ob;
    var ma = a.name.match(/\d{4}/);
    var mb = b.name.match(/\d{4}/);
    var yearA = parseInt(ma ? ma[0] : "0", 10) || 0;
    var yearB = parseInt(mb ? mb[0] : "0", 10) || 0;
    if (yearB !== yearA) return yearB - yearA;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function getSchoolLevel(school) {
  var s = normalize(school);
  // 高中白名单:合肥一中(含长江路校区)、六中、八中、一六八中
  var highSchools = [
    "合肥市第一中学",
    "合肥市第一中学长江路校区",
    "合肥市第六中学",
    "合肥市第八中学",
    "合肥一六八中学"
  ];
  for (var hi = 0; hi < highSchools.length; hi++) {
    if (s === normalize(highSchools[hi])) return "high";
  }
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
  // 高中白名单(强制归 high,即该校学生在 results.json 里只有 CCF 比赛也能出现在高中 tab)
  var highWhiteList = [
    "合肥市第一中学", "合肥市第一中学长江路校区",
    "合肥市第六中学", "合肥市第八中学", "合肥一六八中学"
  ];
  // 预先 seed 高中条目
  highWhiteList.forEach(function(s) {
    map.set(s + "__high", { school: s, level: "high", teamFirst: 0, teamSecond: 0, teamThird: 0, first: 0, second: 0, third: 0, total: 0 });
  });

  rows.forEach(function(row) {
    var school = String(row.school || "");
    if (!school) return;
    var c = String(row.contest || "").trim();
    if (c && c.indexOf("年合肥市赛") < 0) return;
    // 高中白名单:这些校的记录全部归 high(即使 contest 是市赛初中组,历史上有初中部也算高中)
    var isHigh = false;
    for (var hi = 0; hi < highWhiteList.length; hi++) {
      if (school === highWhiteList[hi]) { isHigh = true; break; }
    }
    var level;
    if (isHigh) {
      level = "high";
    } else {
      level = c.indexOf("小学") >= 0 ? "primary" : c.indexOf("初中") >= 0 ? "middle" : getSchoolLevel(school);
    }
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
  var sortField = "rating";
  var sortDir = -1;
  var sortFieldMap = {"一等奖":"first","二等奖":"second","三等奖":"third","总计":"total","评级":"rating","评分":"score"};

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
      renderEmpty(tbody, 8, "No matched players");
      summary.textContent = "共 0 名选手";
      if (pagination) pagination.innerHTML = "";
      return;
    }
    tbody.innerHTML = pageItems.map(function(row, idx) {
      var rank = start + idx + 1;
      var rl1 = row.rating >= 4 ? " rl-" + row.rating : " rl-default";
      return "<tr><td>" + rank + "</td><td>" + "<a class=\"table-link" + rl1 + "\" href=\"./hfoi-player-detail?name=" + encodeURIComponent(row.name) + "&school=" + encodeURIComponent(row.school) + "\">" + escapeHtml(row.name) + "</a></td><td><a class=\"table-link\" href=\"./hfoi-school-detail?school=" + encodeURIComponent(row.school) + "\">" + escapeHtml(row.school) + "</a></td><td>" + row.first + "</td><td>" + row.second + "</td><td>" + row.third + "</td><td>" + row.total + "</td><td>" + String(row.rating || 0) + "</td><td>" + (Math.max(0,row.score)||0) + "</td></tr>";
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
    var _sr = buildPlayerStats(searchRows.length ? searchRows : levelRows, merges, currentLevel);
    var _ar = buildPlayerStats(rows, merges, currentLevel);
    _sr.forEach(function(_s) {
      var _f = _ar.find(function(_a) { return _a.name === _s.name && _a.school === _s.school; });
      if (_f !== undefined) { _s.rating = _f.rating; _s.score = _f.score; }
      });
    
    if (sortField && _sr && _sr.length) {
      _sr.sort(function(a, b) {
        var va = Number(a[sortField] || 0);
        var vb = Number(b[sortField] || 0);
        return (va - vb) * sortDir;
      });
    }
    paint(_sr, 1);
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
  

  // Add sort click handlers
  var thead = document.querySelector("#playersTableWrap table thead");
  if (thead) {
    thead.querySelectorAll("th").forEach(function(th) {
      var field = sortFieldMap[th.textContent.trim()];
      if (field) {
        th.style.cursor = "pointer";
        th.title = "点击排序";
        th.addEventListener("click", function() {
          if (sortField === field) sortDir = -sortDir;
          else { sortField = field; sortDir = -1; }
          thead.querySelectorAll("th").forEach(function(t) { t.classList.remove("sort-asc", "sort-desc"); });
          th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
          refresh();
        });
      }
    });
  }
  
  // Set initial sort indicator
  if (thead && sortField) {
    thead.querySelectorAll("th").forEach(function(th) {
      if (sortFieldMap[th.textContent.trim()] === sortField) {
        th.classList.add("sort-desc");
      }
    });
  }
  paint(buildPlayerStats(currentRows, merges, currentLevel), 1);
}
// ===== Schools Page =====
function renderSchools(rows, teamRows) {
  var input = document.getElementById("schoolSearchInput");
  var summary = document.getElementById("schoolsSummary");
  var tbody = document.getElementById("schoolsBody");
  var pagination = document.getElementById("schoolsPagination");
  var tabGroup = document.getElementById("schoolTabGroupPage");
  if (!input || !summary || !tbody) return;

  // 高中固定排序:合肥一中 → 一六八中 → 八中 → 一中长江路 → 六中
  var HIGH_SCHOOL_ORDER = [
    "合肥市第一中学",
    "合肥一六八中学",
    "合肥市第八中学",
    "合肥市第一中学长江路校区",
    "合肥市第六中学"
  ];
  var highOrderMap = {};
  HIGH_SCHOOL_ORDER.forEach(function(s, i) { highOrderMap[s] = i; });
  function sortHigh(list) {
    return list.slice().sort(function(a, b) {
      var ai = highOrderMap[a.school] !== undefined ? highOrderMap[a.school] : 999;
      var bi = highOrderMap[b.school] !== undefined ? highOrderMap[b.school] : 999;
      return ai - bi;
    });
  }

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
      // 高中 tab 时 9 列变 2 列
      var tableEmpty = document.getElementById("schoolsTable");
      var colspan = currentLevel === "high" ? 2 : 9;
      if (tableEmpty) tableEmpty.classList.toggle("hide-awards", currentLevel === "high");
      renderEmpty(tbody, colspan, "No matched schools");
      summary.textContent = "Total 0 schools";
      if (pagination) pagination.innerHTML = "";
      return;
    }
    // 高中 tab 时切换 class 隐藏 7 列
    var table = document.getElementById("schoolsTable");
    if (table) table.classList.toggle("hide-awards", currentLevel === "high");
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
    var list = all.filter(function(s) { return s.level === level; });
    if (level === "high") list = sortHigh(list);
    paint(list, 1);
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
    var filtered = keyword ? base.filter(function(row) { return normalize(row.school).indexOf(keyword) !== -1; }) : base;
    if (currentLevel === "high") filtered = sortHigh(filtered);
    paint(filtered, 1);
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
function renderContestDetail(rows, teamRows, merges) {
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
  var isCCF = contestName.indexOf("年合肥市赛") < 0;
  var schoolTabBtn = tabGroup && tabGroup.querySelector('[data-tab="schools"]');
  if (isCCF && schoolTabBtn) { schoolTabBtn.style.display = "none"; if (schoolPanel) schoolPanel.style.display = "none"; }

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
    var oa = getContestPriority(a.contest);
    var ob = getContestPriority(b.contest);
    if (oa !== ob) return oa - ob;
    return Number(a.rank || 99999) - Number(b.rank || 99999);
  });

  // ===== Render Players Tab =====
  // Pre-compute max rating for each player from all records
  var maxRatingForName = {};
  list.forEach(function(p) {
    if (maxRatingForName[p.name + "__" + p.school] !== undefined) return;
    var cs2 = p.school;
    if (merges) { merges.forEach(function(m) {
      if (m.name === p.name) {
        var ms = []; if (m.schools) { if (m.schools.high) ms.push(m.schools.high); if (m.schools.middle) ms.push(m.schools.middle); if (m.schools.primary) ms.push(m.schools.primary); }
        if (m.merged_schools) ms = ms.concat(m.merged_schools);
        if (ms.indexOf(p.school) >= 0) { cs2 = m.schools["high"] || m.schools["middle"] || m.schools["primary"] || p.school; }
      }
    }); }
    var mr = 0;
    rows.forEach(function(r) {
      if (normalize(r.name) === normalize(p.name)) {
        var rcs = r.school;
        if (merges) { merges.forEach(function(m) {
          if (m.name === r.name) {
            var ms2 = []; if (m.schools) { if (m.schools.high) ms2.push(m.schools.high); if (m.schools.middle) ms2.push(m.schools.middle); if (m.schools.primary) ms2.push(m.schools.primary); }
            if (m.merged_schools) ms2 = ms2.concat(m.merged_schools);
            if (ms2.indexOf(r.school) >= 0) { rcs = m.schools["high"] || m.schools["middle"] || m.schools["primary"] || r.school; }
          }
        }); }
        if (normalize(rcs) === normalize(cs2)) {
          var rlv = getRatingLevel(r, rows);
          if (rlv > mr) mr = rlv;
        }
      }
    });
    maxRatingForName[p.name + "__" + p.school] = mr;
  });
  function renderPlayers() {
    if (!list.length) {
      renderEmpty(tbody, 5, "暂无排名记录");
      summary.textContent = "共 0 条记录";
      return;
    }

 var scoreEl = document.getElementById("playerDetailScore");
  var contestTotals = {};
  if (scoreEl) {
    rows.forEach(function(r) {
      var cc = String(r.contest || "").trim();
      if (cc) { if (!contestTotals[cc]) contestTotals[cc] = 0; contestTotals[cc]++; }
    });
    var totalScore = 0;
    var maxScore = 0;
    list.forEach(function(r) {
      var w = getContestWeight(String(r.contest || "").trim());
      if (w > 0) {
        var rk = Number(r.rank || 0);
        var tp = contestTotals[String(r.contest || "").trim()] || 0;
        if (rk > 0 && tp > 0) {
          var sc = Math.round(100 * (2 - Math.sqrt(rk / tp)) * w);
          totalScore += sc;
          if (sc > maxScore) maxScore = sc;
        }
      }
    });
    if (totalScore > 0) {
        scoreEl.textContent = "评分: " + totalScore + " (最高单场: " + maxScore + ")";
    }
  }

  tbody.innerHTML = list.map(function(row) {
      var rl2 = maxRatingForName[row.name + "__" + row.school] || 0;
      var rlCls = rl2 >= 4 ? " rl-" + rl2 : " rl-default";
      return '<tr><td>' + escapeHtml(row.rank) + '</td><td>' + '<a class="table-link' + rlCls + '" href="./hfoi-player-detail?name=' + encodeURIComponent(row.name) + '&school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.name) + '</a></td><td>' + '<a class="table-link" href="./hfoi-school-detail?school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.school) + '</a></td><td>' + escapeHtml(row.award) + '</td><td>' + escapeHtml(row.year) + '</td></tr>';
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
function renderPlayerDetail(rows, profiles, merges, achievements) {
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
  // 全局 records:按 name 过滤,不再按 strict school 过滤(避免升学后看不到其他校的战绩)
  var list = rows.filter(function(row) { return n(row.name) === n(name); });

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

  // Tab switching
  var tabGroup2 = document.getElementById("playerDetailTabGroup");
  var recordsPanel = document.getElementById("playerRecordsPanel");
  var achPanel2 = document.getElementById("playerAchievementPanel");
  if (tabGroup2) {
    tabGroup2.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabGroup2.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var tab = btn.getAttribute("data-tab");
        if (recordsPanel) recordsPanel.style.display = tab === "records" ? "" : "none";
        if (achPanel2) achPanel2.style.display = tab === "achievements" ? "" : "none";
        if (tab === "achievements" && achPanel2 && achievements) {
          var body2 = document.getElementById("playerAchievementBody");
          if (body2) {
            var playerAch = achievements[name] || [];
            body2.innerHTML = playerAch.length ? '<div class="achievement-grid">' + playerAch.map(function(x) { return '<div class="achievement-card">' + escapeHtml(x) + '</div>'; }).join("") + '</div>' : "<p>暂无成就</p>";
          }
        }
      });
    });
  }

  list.sort(function(a, b) {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    var oa = getContestPriority(a.contest);
    var ob = getContestPriority(b.contest);
    if (oa !== ob) return oa - ob;
    return Number(a.rank || 99999) - Number(b.rank || 99999);
  });

  // Show player rating (max over ALL records)
  var ratingEl = document.getElementById("playerDetailRating");
  if (ratingEl) {
    var maxRating = 0;
    list.forEach(function(r) { var rlv = getRatingLevel(r, rows); if (rlv > maxRating) maxRating = rlv; });
    ratingEl.textContent = maxRating > 0 ? maxRating + " 级" : "-";
    if (title) title.className = maxRating >= 4 ? "rl-" + maxRating : "rl-default";
  }

  tbody.innerHTML = list.map(function(row) {
    var cname = contestNameOf(row);
    var contestLink = '<a class="table-link" href="./hfoi-contest-detail?name=' + encodeURIComponent(cname) + '">' + escapeHtml(cname) + '</a>';
    
    var sc = 0;
    var w = getContestWeight(cname);
    if (w > 0) {
      var rk = Number(row.rank || 0);
      var tp = 0;
      for (var ri = 0; ri < rows.length; ri++) {
        if (String(rows[ri].contest || "").trim() === cname) tp++;
      }
      if (rk > 0 && tp > 0) {
        sc = Math.round(100 * (2 - Math.sqrt(rk / tp)) * w);
      }
    }
    return '<tr><td>' + contestLink + '</td><td><a class="table-link" href="./hfoi-school-detail?school=' + encodeURIComponent(row.school) + '">' + escapeHtml(row.school) + '</a></td><td>' + escapeHtml(row.award) + '</td><td>' + escapeHtml(row.rank) + '</td><td>+' + sc + '</td></tr>';
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
    if (cname.indexOf("年合肥市赛") < 0) return;  // 只显示合肥市赛
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

  // 整段比赛表 panel:0 数据时隐藏(没意义的"暂无比赛数据"占位去掉)
  var contestPanel = document.getElementById("schoolDetailContestPanel");
  if (contestPanel) contestPanel.style.display = contestList.length ? "" : "none";

  var currentTab = "all";

  function paint() {
    var filtered = currentTab === "all" ? contestList : contestList.filter(function(item) {
      if (currentTab === "primary") return item.contest.indexOf("小学") >= 0;
      if (currentTab === "middle") return item.contest.indexOf("初中") >= 0;
      if (currentTab === "high") return item.contest.indexOf("年合肥市赛") < 0;
      return true;
    });
    // 高中 tab 不显示团体奖(3 列)
    var table = document.getElementById("schoolDetailTable");
    var hideTeam = currentTab === "high";
    if (table) table.classList.toggle("hide-team-awards", hideTeam);
    var colspan = hideTeam ? 4 : 7;
    if (!filtered.length) {
      renderEmpty(tbody, colspan, "暂无比赛数据");
      summary.textContent = "共 0 场比赛";
      return;
    }
    tbody.innerHTML = filtered.map(function(item) {
      var cname = item.contest;
      var contestLink = '<a class="table-link" href="./hfoi-contest-detail?name=' + encodeURIComponent(cname) + '">' + escapeHtml(cname) + '</a>';
      if (hideTeam) {
        return '<tr><td>' + contestLink + '</td><td>' + item.first + '</td><td>' + item.second + '</td><td>' + item.third + '</td></tr>';
      }
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

  // 折线图 + 选手列表
  renderSchoolChart(list, rows);
  renderSchoolPlayerList(list, rows);
}

// ===== School Detail: Award Trend Chart =====
function classifyContestType(contest) {
  var c = String(contest || "");
  // 顺序很重要:长的/特殊的先匹配
  if (c.indexOf("省选") >= 0) return "省选";
  if (c.indexOf("市赛") >= 0 && c.indexOf("小学组") >= 0) return "市赛小学组";
  if (c.indexOf("市赛") >= 0 && c.indexOf("初中组") >= 0) return "市赛初中组";
  if (c.indexOf("CSP-S") >= 0) return "CSP-S";
  if (c.indexOf("CSP-J") >= 0) return "CSP-J";
  if (c.indexOf("NOI ") >= 0 && c.indexOf("NOIP") < 0) return "NOI";
  if (c.indexOf("APIO") >= 0) return "APIO";
  if (c.indexOf("WC") >= 0) return "WC";
  if (c.indexOf("NOIP") >= 0) return "NOIP";
  return null;
}

function buildSchoolChartData(list, allRows, type) {
  // 全市每年该类比赛记录数(用来判断"是否已举办")
  var globalByYear = {};
  allRows.forEach(function(r) {
    if (classifyContestType(r.contest) !== type) return;
    var y = Number(r.year || 0);
    if (!y) return;
    globalByYear[y] = (globalByYear[y] || 0) + 1;
  });

  // 校内按年聚合(按金/银/铜,而不是一/二/三等,避免 NOI 金/银/铜和市赛一二三等挤同一条线)
  var byYear = {};
  list.forEach(function(r) {
    if (classifyContestType(r.contest) !== type) return;
    var y = Number(r.year || 0);
    if (!y) return;
    if (!byYear[y]) byYear[y] = { gold: 0, silver: 0, bronze: 0 };
    var medal = getMedalLevel(r.award);
    if (medal === "gold") byYear[y].gold++;
    else if (medal === "silver") byYear[y].silver++;
    else if (medal === "bronze") byYear[y].bronze++;
  });

  // 某年全市无记录 → null(不画点,折线段断开,语义:"未举办")
  var years = [2021, 2022, 2023, 2024, 2025, 2026];
  function v(y, key) {
    if (!globalByYear[y]) return null;
    return (byYear[y] && byYear[y][key]) || 0;
  }
  return {
    years: years,
    // z 顺序:数组后面的画在上面 → 把金牌放最后(顶层),铜牌放最前(底层)
    series: [
      { name: "铜牌", data: years.map(function(y) { return v(y, "bronze"); }), color: "#a0522d", z: 1 },
      { name: "银牌", data: years.map(function(y) { return v(y, "silver"); }), color: "#9ca3af", z: 2 },
      { name: "金牌", data: years.map(function(y) { return v(y, "gold"); }),   color: "#d4a017", z: 3 }
    ]
  };
}

function renderSchoolChart(list, allRows) {
  var chartDom = document.getElementById("schoolChart");
  var empty = document.getElementById("schoolChartEmpty");
  var tabGroup = document.getElementById("schoolChartTabGroup");
  if (!chartDom || !tabGroup) return;

  // 筛选该校 strict 范围内"有数据"的比赛类型
  var ALL_TYPES = ["市赛小学组", "市赛初中组", "CSP-S", "CSP-J", "NOIP", "NOI", "APIO", "WC", "省选"];
  var availableTypes = ALL_TYPES.filter(function(t) {
    return list.some(function(r) { return classifyContestType(r.contest) === t; });
  });

  // 0 数据:整个 chart panel 隐藏
  if (!availableTypes.length) {
    var chartPanel = document.getElementById("schoolDetailChartPanel");
    if (chartPanel) chartPanel.style.display = "none";
    return;
  }

  // 用有数据的类型重写 tab group
  tabGroup.innerHTML = availableTypes.map(function(t, i) {
    return '<button class="tab-btn' + (i === 0 ? " active" : "") + '" data-type="' + t + '">' + t + '</button>';
  }).join("");

  var chart = null;
  var echartsWaitTries = 0;
  function tryInit() {
    if (typeof echarts === "undefined") {
      // 等 echarts 本地脚本加载,最多等 5 秒
      if (++echartsWaitTries > 50) {
        if (empty) {
          empty.textContent = "图表库加载失败,请检查 vendor/echarts.min.js";
          empty.style.display = "";
        }
        return;
      }
      setTimeout(tryInit, 100);
      return;
    }
    chart = echarts.init(chartDom);
    paintChart(availableTypes[0]);
  }

  function paintChart(type) {
    var data = buildSchoolChartData(list, allRows, type);
    if (!data.years.length) {
      chart.clear();
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    chart.setOption({
      tooltip: { trigger: "axis" },
      legend: { data: data.series.map(function(s) { return s.name; }), top: 10 },
      grid: { left: 50, right: 30, top: 50, bottom: 40 },
      xAxis: { type: "category", data: data.years, boundaryGap: false },
      yAxis: { type: "value", minInterval: 1, min: 0 },
      series: data.series.map(function(s) {
        return {
          name: s.name,
          type: "line",
          smooth: false,
          connectNulls: false,
          symbol: "circle",
          symbolSize: 9,
          data: s.data,
          z: s.z || 1,
          itemStyle: { color: s.color, borderColor: "#fff", borderWidth: 2 },
          lineStyle: { color: s.color, width: 3, shadowColor: s.color, shadowBlur: 6, shadowOffsetY: 2 },
          emphasis: { focus: "series", lineStyle: { width: 4 } }
        };
      })
    });
  }

  tabGroup.querySelectorAll(".tab-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      tabGroup.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      paintChart(btn.getAttribute("data-type"));
    });
  });

  // 窗口大小变化时重绘
  window.addEventListener("resize", function() { if (chart) chart.resize(); });

  tryInit();
}

// ===== School Detail: Player List =====
function renderSchoolPlayerList(list, allRows) {
  var tbody = document.getElementById("schoolPlayersBody");
  var summary = document.getElementById("schoolPlayersSummary");
  var pagination = document.getElementById("schoolPlayersPagination");
  if (!tbody) return;

  var PAGE_SIZE = 30;

  // 选手列表只列出该校的(strict 范围),但评级用全局 allRows 算(跨校合并)
  var globalByName = {};
  allRows.forEach(function(r) {
    var key = String(r.name || "");
    if (!key) return;
    if (!globalByName[key]) globalByName[key] = { maxRating: 0 };
    var rl = getRatingLevel(r, allRows);
    if (rl > globalByName[key].maxRating) globalByName[key].maxRating = rl;
  });

  var byName = {};
  var currentSchool = String((list[0] && list[0].school) || "");
  list.forEach(function(r) {
    var key = String(r.name || "");
    if (!key) return;
    if (!byName[key]) {
      byName[key] = { name: key, maxRating: (globalByName[key] && globalByName[key].maxRating) || 0 };
    }
  });

  var players = Object.values(byName).sort(function(a, b) {
    if (b.maxRating !== a.maxRating) return b.maxRating - a.maxRating;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  if (!players.length) {
    renderEmpty(tbody, 3, "暂无选手记录");
    if (summary) summary.textContent = "共 0 名选手";
    if (pagination) pagination.innerHTML = "";
    return;
  }

  function paint(page) {
    if (!page || page < 1) page = 1;
    var totalPages = Math.ceil(players.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, players.length);
    var pageItems = players.slice(start, end);

    tbody.innerHTML = pageItems.map(function(p, idx) {
      var rlCls = p.maxRating >= 4 ? " rl-" + p.maxRating : "rl-default";
      var rlText = p.maxRating > 0 ? p.maxRating : "-";
      return '<tr><td>' + (start + idx + 1) + '</td><td><a class="table-link ' + rlCls + '" href="./hfoi-player-detail?name=' + encodeURIComponent(p.name) + '&school=' + encodeURIComponent(currentSchool) + '">' + escapeHtml(p.name) + '</a></td><td>' + rlText + '</td></tr>';
    }).join("");

    if (summary) summary.textContent = "第 " + page + " / " + totalPages + " 页 | 共 " + players.length + " 名选手";

    if (pagination) {
      if (totalPages <= 1) { pagination.innerHTML = ""; return; }
      var html = "";
      if (page > 1) html += "<button class=\"page-btn\" data-page=\"" + (page - 1) + "\">上一页</button>";
      for (var p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
        html += "<button class=\"page-btn" + (p === page ? " active" : "") + "\" data-page=\"" + p + "\">" + p + "</button>";
      }
      if (page < totalPages) html += "<button class=\"page-btn\" data-page=\"" + (page + 1) + "\">下一页</button>";
      pagination.innerHTML = html;
      pagination.style.display = "";
      pagination.querySelectorAll(".page-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var np = parseInt(this.getAttribute("data-page"));
          paint(np);
          // 滚到选手列表顶部
          try { document.getElementById("schoolPlayersPagination").scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
        });
      });
    }
  }

  paint(1);
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
    const r = await fetch("./data/player_merges.json?v=" + 1749177600000);
    if (!r.ok) return h;
    const d = await r.json();
    return Array.isArray(d) && d.length ? d : h;
  } catch { return h; }
}

async function loadPinyin() {
  var h = {"黄乐逸":{"full":"huang le yi","short":"hly"},"吴一鸣":{"full":"wu yi ming","short":"wym"}};
  try {
    const r = await fetch("./data/pinyin.json?v=" + 1749177600000);
    if (!r.ok) return h;
    const d = await r.json();
    return (typeof d === "object" && !Array.isArray(d)) ? Object.assign({}, h, d) : h;
  } catch { return h; }
}
 
async function loadContestPriority() {
  try {
    const r = await fetch("./data/contest_priority.json");
    if (r.ok) contestPriorityRules = await r.json();
  } catch(e) {}
}

async function loadPlayerAchievements() {
  try {
    const r = await fetch("./data/player_achievements.json?v=" + 1749177600000);
    if (!r.ok) return {};
    return await r.json();
  } catch { return {}; }
}

async function init() {
  setActiveNav();
  try {
    var rows, teamRows, profiles;
    var data = await Promise.all([loadResults(), loadSchoolTeams(), loadAnnouncements(), loadPlayerProfiles(), loadPlayerMerges(), loadPinyin(), loadSchoolAliases()]);
    rows = data[0];
    teamRows = data[1];
    var announcements = data[2];
        profiles = data[3];
    var merges = data[4];
   var pinyin = data[5];
   var aliases = data[6] || {};
    // 应用学校别名标准化(例:"安徽省合肥市第四十五中学" -> "合肥市第四十五中学")
    if (aliases && Object.keys(aliases).length) {
      applySchoolAliases(rows, aliases);
      if (teamRows && teamRows.length) applySchoolAliases(teamRows, aliases);
    }
   var achievements = await loadPlayerAchievements();
    await loadContestPriority();
   var page = document.body.dataset.page;
    if (page === "home") renderHome(rows, teamRows, announcements, merges);
    if (page === "players") renderPlayers(rows, merges, pinyin);
    if (page === "schools") renderSchools(rows, teamRows);
    if (page === "contests") renderContests(rows);
    if (page === "contest-detail") renderContestDetail(rows, teamRows, merges); if (page === "player-detail") renderPlayerDetail(rows, profiles, merges, achievements); if (page === "school-detail") renderSchoolDetail(rows, teamRows);
  } catch (error) {
    console.error(error);
    document.querySelectorAll("tbody").forEach(function(tbody) { renderEmpty(tbody, 10, "数据加载失败"); });
    document.querySelectorAll(".summary").forEach(function(node) { node.textContent = "数据文件加载失败"; });
  }
}

init();
// Site visit counter
try {
  var _vc = parseInt(localStorage.getItem("hfoi_site_visits") || "0", 10) + 1;
  localStorage.setItem("hfoi_site_visits", _vc);
  var _vf = document.querySelector(".container.footer") || document.querySelector(".footer");
  if (_vf && !_vf.querySelector(".visit-counter")) {
    var _vd = document.createElement("div");
    _vd.className = "visit-counter";
    _vd.style.cssText = "font-size:0.75rem;color:hsl(var(--muted-foreground));margin-top:4px;text-align:center";
    _vd.textContent = "本站累计访问 " + _vc + " 次";
    _vf.appendChild(_vd);
  }
} catch(e) {}

