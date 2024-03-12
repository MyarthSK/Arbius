import * as fs from 'fs';
import { MiningConfig } from './types';
import { log } from './log';
import { now, taskid2Seed } from './utils';
import {
  QueueJobProps,
  StoreTaskProps,
  StoreSolutionProps,
  StoreContestationProps,
  StoreContestationVoteProps,
  Job,
  DBTask,
  DBTaskTxid,
  DBTaskInput,
  DBInvalidTask,
  DBSolution,
  DBJob,
  DBContestation,
  DBContestationVote,
} from './types';

let tasks: DBTask[] = [];
let taskInputs: DBTaskInput[] = [];
let solutions: DBSolution[] = [];
let contestations: DBContestation[] = [];
let contestationVotes: DBContestationVote[] = [];
let jobs: DBJob[] = [];
let failedJobs: DBJob[] = [];
let taskTxids: DBTaskTxid[] = [];

export async function initializeDatabase(c: MiningConfig): Promise<void> {
  tasks = [];
  taskInputs = [];
  solutions = [];
  contestations = [];
  contestationVotes = [];
  jobs = [];
  failedJobs = [];
  taskTxids = [];
}

export async function dbGetTask(taskid: string): Promise<DBTask | null> {
  return tasks.find((task) => task.id === taskid) || null;
}

export async function dbGetSolution(taskid: string): Promise<DBSolution | null> {
  return solutions.find((solution) => solution.taskid === taskid) || null;
}

export async function dbGetContestation(taskid: string): Promise<DBContestation | null> {
  return contestations.find((contestation) => contestation.taskid === taskid) || null;
}

export async function dbGetInvalidTask(taskid: string): Promise<DBInvalidTask | null> {
  return failedJobs.find((failedJob) => failedJob.data.taskid === taskid) || null;
}

export async function dbGetContestationVotes(taskid: string): Promise<DBContestationVote[]> {
  return contestationVotes.filter((vote) => vote.taskid === taskid);
}

export async function dbGetTaskTxid(taskid: string): Promise<string | null> {
  const taskTxid = taskTxids.find((txid) => txid.taskid === taskid);
  return taskTxid ? taskTxid.txid : null;
}

export async function dbGetTaskInput(taskid: string, cid: string): Promise<DBTaskInput | null> {
  const input = taskInputs.find((input) => input.taskid === taskid && input.cid === cid);
  if (input) {
    const data = JSON.parse(input.data);
    data.seed = taskid2Seed(taskid);
    input.data = JSON.stringify(data);
    return input;
  }
  return null;
}

export async function dbGetJob(jobid: number): Promise<DBJob | null> {
  return jobs.find((job) => job.id === jobid) || null;
}

export async function dbGetJobs(limit: number = 10000): Promise<DBJob[]> {
  return jobs.slice(0, limit);
}

export async function dbStoreTask({
  taskid,
  modelid,
  fee,
  owner,
  blocktime,
  version,
  cid,
}: StoreTaskProps): Promise<DBTask | null> {
  const newTask: DBTask = {
    id: taskid,
    modelid,
    fee: fee.toString(),
    address: owner,
    blocktime: blocktime.toString(),
    version,
    cid,
    retracted: false,
  };
  tasks.push(newTask);
  return newTask;
}

export async function dbStoreInvalidTask(taskid: string): Promise<DBInvalidTask | null> {
  const existing = await dbGetInvalidTask(taskid);
  if (existing != null) {
    log.warn(`dbStoreInvalidTask: Invalid task ${taskid} already exists`);
    return { taskid };
  }

  const newInvalidTask: DBInvalidTask = { taskid };
  failedJobs.push({ id: failedJobs.length + 1, method: 'invalid_task', data: JSON.stringify(newInvalidTask) });
  return newInvalidTask;
}

export async function dbStoreFailedJob(job: DBJob): Promise<boolean | null> {
  failedJobs.push(job);
  return true;
}

export async function dbUpdateTaskSetRetracted(taskid: string): Promise<boolean> {
  const task = tasks.find((task) => task.id === taskid);
  if (task) {
    task.retracted = true;
    return true;
  }
  return false;
}

export async function dbQueueJob({
  method,
  priority,
  waituntil,
  concurrent,
  data,
}: QueueJobProps): Promise<Job> {
  log.info(`QueueJob ${method} ${priority} ${waituntil} ${concurrent ? 'concurrent' : 'blocking'}`);

  const newJob: Job = {
    method,
    priority,
    waituntil,
    concurrent,
    data,
  };
  jobs.push({ id: jobs.length + 1, ...newJob });
  return newJob;
}

export async function dbGarbageCollect(): Promise<void> {
  let before = now() - 60;

  let methods = ['task', 'pinTaskInput', 'solution'];

  for (let method of methods) {
    jobs = jobs.filter((job) => !(job.method === method && job.waituntil < before));
  }
}

export async function dbDeleteJob(jobid: number): Promise<void> {
  jobs = jobs.filter((job) => job.id !== jobid);
}

export async function dbClearJobsByMethod(method: string): Promise<void> {
  jobs = jobs.filter((job) => job.method !== method);
}

export async function dbStoreTaskTxid(taskid: string, txid: string): Promise<boolean> {
  taskTxids.push({ taskid, txid });
  return true;
}

export async function dbStoreTaskInput(taskid: string, cid: string, input: any): Promise<boolean> {
  taskInputs.push({ taskid, cid, data: JSON.stringify(input) });
  return true;
}

export async function dbStoreSolution({
  taskid,
  validator,
  blocktime,
  claimed,
  cid,
}: StoreSolutionProps): Promise<boolean> {
  solutions.push({ taskid, validator, blocktime: blocktime.toString(), claimed, cid });
  return true;
}

export async function dbStoreContestation({
  taskid,
  validator,
  blocktime,
  finish_start_index,
}: StoreContestationProps): Promise<boolean> {
  contestations.push({ taskid, validator, blocktime: blocktime.toString(), finish_start_index });
  return true;
}

export async function dbStoreContestationVote({
  taskid,
  validator,
  yea,
}: StoreContestationVoteProps): Promise<boolean> {
  contestationVotes.push({ taskid, validator, yea });
  return true;
}