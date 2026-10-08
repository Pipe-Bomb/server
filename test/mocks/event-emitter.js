const { EventEmitter } = require("events");

class EventEmitter2 extends EventEmitter {
	emitAsync(event, ...values) {
		return Promise.resolve([this.emit(event, ...values)]);
	}
}

class EventEmitterModule {
	static forRoot() {
		return { module: EventEmitterModule, global: true };
	}
}

module.exports = { EventEmitter2, EventEmitterModule };
