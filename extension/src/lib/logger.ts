import log from "loglevel";

const isDev = import.meta.env.DEV;
const level = isDev ? log.levels.DEBUG : log.levels.INFO;

const originalMethodFactory = log.methodFactory;
log.methodFactory = (methodName, logLevel, loggerName) => {
  const originalMethod = originalMethodFactory(methodName, logLevel, loggerName);
  const prefix = loggerName != null ? `[${loggerName.toString()}] ` : "";
  return (message) => originalMethod(`${prefix}${message}`);
};
log.setLevel(level);

log.info(`Environment: ${isDev ? "development" : "production"}`);

export default log;
