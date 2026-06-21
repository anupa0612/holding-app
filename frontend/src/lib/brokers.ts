import type { Broker, ReconType } from './api'

const RECON_TYPES: ReconType[] = ['trade', 'position', 'fi']

/** Types enabled for a broker (API field + templateKeys/templateKey fallback). */
export function brokerSupportedReconTypes(broker: Broker | undefined): ReconType[] {
  if (!broker) return []
  if (broker.supportedReconTypes?.length) return broker.supportedReconTypes

  const fromKeys = Object.keys(broker.templateKeys ?? {}).filter((k): k is ReconType =>
    RECON_TYPES.includes(k as ReconType),
  )
  if (fromKeys.length) return fromKeys

  if (broker.templateKey) return ['position']
  return []
}
