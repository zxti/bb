import env from "../../environment"
import pino, { LoggerOptions } from "pino"
import * as context from "../../context"
import * as correlation from "../correlation"
import { IdentityType } from "@budibase/types"

// LOGGER

const pinoOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  formatters: {
    level: label => {
      return { level: label.toUpperCase() }
    },
    bindings: () => {
      return {}
    },
  },
  timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
}

if (env.isDev()) {
  pinoOptions.transport = {
    target: "pino-pretty",
    options: {
      singleLine: true,
    },
  }
}

export const logger = pino(pinoOptions)

// CONSOLE OVERRIDES

interface MergingObject {
  objects?: any[]
  tenantId?: string
  appId?: string
  identityId?: string
  identityType?: IdentityType
  correlationId?: string
  err?: Error
}

function isPlainObject(obj: any) {
  return typeof obj === "object" && obj !== null && !(obj instanceof Error)
}

function isError(obj: any) {
  return obj instanceof Error
}

function isMessage(obj: any) {
  return typeof obj === "string"
}

/**
 * Backwards compatibility between console logging statements
 * and pino logging requirements.
 */
function getLogParams(args: any[]): [MergingObject, string] {
  let error = undefined
  let objects: any[] = []
  let message = ""

  args.forEach(arg => {
    if (isMessage(arg)) {
      message = `${message} ${arg}`.trimStart()
    }
    if (isPlainObject(arg)) {
      objects.push(arg)
    }
    if (isError(arg)) {
      error = arg
    }
  })

  const identity = getIdentity()

  const mergingObject = {
    objects: objects.length ? objects : undefined,
    tenantId: getTenantId(),
    appId: getAppId(),
    identityId: identity?._id,
    identityType: identity?.type,
    correlationId: correlation.getId(),
    err: error,
  }

  return [mergingObject, message]
}

console.log = (...arg: any[]) => {
  const [obj, msg] = getLogParams(arg)
  logger.info(obj, msg)
}
console.info = (...arg: any[]) => {
  const [obj, msg] = getLogParams(arg)
  logger.info(obj, msg)
}
console.warn = (...arg: any[]) => {
  const [obj, msg] = getLogParams(arg)
  logger.warn(obj, msg)
}
console.error = (...arg: any[]) => {
  const [obj, msg] = getLogParams(arg)
  logger.error(obj, msg)
}

/**
 * custom trace impl - this resembles the node trace behaviour rather
 * than traditional trace logging
 * @param arg
 */
console.trace = (...arg: any[]) => {
  const [obj, msg] = getLogParams(arg)
  if (!obj.err) {
    // to get stack trace
    obj.err = new Error()
  }
  logger.trace(obj, msg)
}

console.debug = (...arg: any) => {
  const [obj, msg] = getLogParams(arg)
  logger.debug(obj, msg)
}

// CONTEXT

const getTenantId = () => {
  let tenantId
  try {
    tenantId = context.getTenantId()
  } catch (e: any) {
    // do nothing
  }
  return tenantId
}

const getAppId = () => {
  let appId
  try {
    appId = context.getAppId()
  } catch (e) {
    // do nothing
  }
  return appId
}

const getIdentity = () => {
  let identity
  try {
    identity = context.getIdentity()
  } catch (e) {
    // do nothing
  }
  return identity
}

export default logger