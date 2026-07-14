const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const rewardBtn = document.querySelector(".reward-btn");
const HISTORY_KEY = "taskHistory";
const taskName = document.getElementById("taskName");
const difficulty = document.getElementById("difficulty");
const taskTime = document.getElementById("taskTime");

const STORAGE_KEY = "dailyTasks";
const DATE_KEY = "daily_timer_start_date";
const REWARD_KEY = "dailyRewardGiven";
const TIMER_KEY = "taskTimers";

const ONE_DAY = 24 * 60 * 60 * 1000;

let tasks = [];
let completedCount = 0;
let rewardGiven = false;

function hasActiveUser() {
  return window.PTM && PTM.getActiveUserName && PTM.getActiveUserName();
}

function scopedKey(key) {
  return hasActiveUser() && PTM.userKey ? PTM.userKey(key) : key;
}

function storageGet(key) {
  return localStorage.getItem(scopedKey(key));
}

function storageSet(key, value) {
  localStorage.setItem(scopedKey(key), value);
  window.dispatchEvent(new Event("ptm:dataChanged"));
}

function storageRemove(key) {
  localStorage.removeItem(scopedKey(key));
  window.dispatchEvent(new Event("ptm:dataChanged"));
}


/* ================= TIMER STORAGE ================= */

function getSavedTimers(){
  return JSON.parse(storageGet(TIMER_KEY)) || {};
}

function saveTimers(timers){
  storageSet(TIMER_KEY, JSON.stringify(timers));
}


/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  checkDailyReset();
  loadTasks();

  const name = localStorage.getItem("userName");

  document.getElementById("welcomeName").innerText =
    name ? "Welcome, " + name + " 👋" : "Welcome 👋";

});


/* ================= SIDEBAR TOGGLE ================= */

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});


/* ================= RENDER TASK ================= */

function renderTask(taskObj) {

  const { name, level, timeNeeded, completed } = taskObj;

  let totalSeconds = parseInt(timeNeeded) * 60;

  const row = document.createElement("div");

  row.className = "task-item";

  if (completed) {
    row.classList.add("completed");
    completedCount++;
  }

  row.innerHTML = `

  <p class="task-title">${name}</p>

  <p class="task-meta">Difficulty: ${level} | Time: ${timeNeeded} mins</p>

  <div class="task-actions">

  <button class="start-task-btn">Start</button>

  <button class="stop-task-btn">Stop</button>

  <button class="complete-task-btn">Complete</button>

  <div class="digital-clock" style="display:none;">
  <span class="real-clock">00:00:00</span>
  </div>

  </div>

  `;

  const startBtn = row.querySelector(".start-task-btn");
  const stopBtn = row.querySelector(".stop-task-btn");
  const completeBtn = row.querySelector(".complete-task-btn");
  const realClock = row.querySelector(".real-clock");
  const digitalClock = row.querySelector(".digital-clock");

  const timers = getSavedTimers();

  let interval = null;
  let startTime = timers[taskObj.id]?.startTime || null;

  if(timers[taskObj.id]?.extra){
    totalSeconds += timers[taskObj.id].extra;
  }

  if (completed) {
    startBtn.disabled = true;
    stopBtn.disabled = true;
  }

  if (startTime) {
    startBtn.disabled = true;
    digitalClock.style.display = "inline-block";
    startExistingTimer();
  }


  /* START TIMER */

  startBtn.addEventListener("click", () => {

    if (interval || taskObj.completed) return;

    startBtn.disabled = true;

    digitalClock.style.display = "inline-block";

    startTime = Date.now();

    timers[taskObj.id] = {startTime:startTime,extra:0};
    saveTimers(timers);

    startExistingTimer();

  });


  function startExistingTimer(){

    interval = setInterval(() => {

      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      const hrs = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
      const mins = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
      const secs = String(elapsedSeconds % 60).padStart(2, "0");

      realClock.textContent = `${hrs}:${mins}:${secs}`;

      if (elapsedSeconds >= totalSeconds) {

        clearInterval(interval);
        interval = null;

        askExtraTime();

      }

    }, 1000);

  }


  /* EXTRA TIME FUNCTION */
function askExtraTime(){

  const needExtra = confirm("⏰ Time is up! Do you need extra time?");

  if(needExtra){

    let extraMin = prompt("Enter extra time in minutes:");

    if(extraMin && !isNaN(extraMin)){

      let extraSeconds = parseInt(extraMin) * 60;

      totalSeconds += extraSeconds;

      timers[taskObj.id].extra += extraSeconds;

      saveTimers(timers);

      startExistingTimer();

    }else{

      // remove timer so popup will not appear again
      delete timers[taskObj.id];
      saveTimers(timers);

      completeTask();

    }

  }else{

    // remove timer so popup will not appear again
    delete timers[taskObj.id];
    saveTimers(timers);

    completeTask();

  }

}


  /* STOP TIMER */

  stopBtn.addEventListener("click", () => {

    clearInterval(interval);

    interval = null;

    delete timers[taskObj.id];
    saveTimers(timers);

    startBtn.disabled = false;

  });


  /* COMPLETE BUTTON */

  completeBtn.addEventListener("click", () => {

    if (!taskObj.completed) {

      clearInterval(interval);

      interval = null;

      delete timers[taskObj.id];
      saveTimers(timers);

      completeTask();

    }

  });


  function completeTask() {

    row.classList.add("completed");

    taskObj.completed = true;
    startBtn.disabled = true;
    stopBtn.disabled = true;

    digitalClock.style.display = "none";

    completedCount++;

    saveTasks();
    saveToHistory(taskObj);

    window.dispatchEvent(new Event("storage"));

    checkReward();
  }

  taskList.prepend(row);

}


/* ================= ADD TASK ================= */

taskForm.addEventListener("submit", (e) => {

  e.preventDefault();

  if (!taskName.value.trim()) return;

  const newTask = {

    id: Date.now(),

    name: taskName.value.trim(),

    level: difficulty.value,

    timeNeeded: taskTime.value,

    taskDate: new Date().toISOString().split("T")[0],

    completed: false

  };

  tasks.push(newTask);

  saveTasks();

  window.dispatchEvent(new Event("storage"));

  renderTask(newTask);

  taskForm.reset();

});


/* ================= STORAGE ================= */

function saveTasks() {

  storageSet(STORAGE_KEY, JSON.stringify(tasks));

}

function loadTasks() {

  tasks = JSON.parse(storageGet(STORAGE_KEY)) || [];

  rewardGiven = storageGet(REWARD_KEY) === "true";

  taskList.innerHTML = "";

  completedCount = 0;

  tasks.forEach(task => renderTask(task));

  checkReward();

}


/* ================= DAILY RESET ================= */

function checkDailyReset() {

  let startDate = storageGet(DATE_KEY);

  const now = Date.now();

  if (!startDate) {

    storageSet(DATE_KEY, now.toString());

    return;

  }

  startDate = parseInt(startDate, 10);

  if (now - startDate >= ONE_DAY) {

    storageRemove(STORAGE_KEY);
    storageRemove(REWARD_KEY);
    storageRemove(TIMER_KEY);

    storageSet(DATE_KEY, now.toString());

    tasks = [];

    completedCount = 0;

    rewardGiven = false;

    taskList.innerHTML = "";

    alert("🌅 Daily reset! Tasks cleared for a fresh start.");

    sidebar.style.background = "";

    rewardBtn.textContent = "🏆";

  }

}


/* ================= REWARD SYSTEM ================= */

function checkReward() {

  if (completedCount >= 5 && !rewardGiven) {

    alert("🎉 Congratulations! You completed 5 tasks! Reward unlocked!");

    rewardGiven = true;

    storageSet(REWARD_KEY, "true");

    sidebar.style.background =
      "linear-gradient(160deg, #8f7dea 0%, #6247AA 100%)";

    rewardBtn.textContent = "🏆✨";

  }

}


/* ================= HISTORY ================= */

function saveToHistory(task) {

  let history = JSON.parse(storageGet(HISTORY_KEY)) || [];

  history.push({
    name: task.name,
    taskDate: task.taskDate,
    completed: true
  });

  storageSet(HISTORY_KEY, JSON.stringify(history));

}
