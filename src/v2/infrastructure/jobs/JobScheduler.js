export class JobScheduler {
  define() { throw new Error('JobScheduler.define must be implemented') }
  scheduleOnce() { throw new Error('JobScheduler.scheduleOnce must be implemented') }
  scheduleRecurring() { throw new Error('JobScheduler.scheduleRecurring must be implemented') }
  cancel() { throw new Error('JobScheduler.cancel must be implemented') }
  start() { throw new Error('JobScheduler.start must be implemented') }
  stopGracefully() { throw new Error('JobScheduler.stopGracefully must be implemented') }
}
