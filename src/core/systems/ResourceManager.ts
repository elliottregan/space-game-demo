import type { GameEvent } from "../models/GameEvent"
import type { ResourceDelta, Resources } from "../models/Resources"
import { RESOURCE_KEYS } from "../models/Resources"

export class ResourceManager {
  private resources: Resources
  private production: ResourceDelta = {}
  private consumption: ResourceDelta = {}

  constructor(initial: Resources) {
    this.resources = { ...initial }
  }

  private updateDelta(
    target: ResourceDelta,
    delta: ResourceDelta,
    subtract: boolean = false,
  ): void {
    for (const [key, value] of Object.entries(delta)) {
      const resourceKey = key as keyof Resources
      const current = target[resourceKey] || 0
      const amount = value || 0
      target[resourceKey] = subtract
        ? Math.max(0, current - amount)
        : current + amount
    }
  }

  tick(): GameEvent[] {
    const events: GameEvent[] = []

    for (const key of RESOURCE_KEYS) {
      const produced = this.production[key] || 0
      const consumed = this.consumption[key] || 0
      const net = produced - consumed

      this.resources[key] += net

      if (this.resources[key] < 0) {
        this.resources[key] = 0
      }

      if (this.resources[key] === 0) {
        events.push({
          type: "RESOURCE_DEPLETED",
          resource: key,
          severity: "critical",
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} depleted!`,
        })
      } else if (this.resources[key] < 20) {
        events.push({
          type: "RESOURCE_LOW",
          resource: key,
          severity: "warning",
          currentAmount: this.resources[key],
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} running low: ${Math.floor(this.resources[key])}`,
        })
      }
    }

    return events
  }

  addProduction(delta: ResourceDelta): void {
    this.updateDelta(this.production, delta)
  }

  removeProduction(delta: ResourceDelta): void {
    this.updateDelta(this.production, delta, true)
  }

  addConsumption(delta: ResourceDelta): void {
    this.updateDelta(this.consumption, delta)
  }

  removeConsumption(delta: ResourceDelta): void {
    this.updateDelta(this.consumption, delta, true)
  }

  canAfford(cost: ResourceDelta): boolean {
    return Object.entries(cost).every(([resource, amount]) => {
      const key = resource as keyof Resources
      return this.resources[key] >= (amount || 0)
    })
  }

  deduct(cost: ResourceDelta): boolean {
    if (!this.canAfford(cost)) return false

    for (const [resource, amount] of Object.entries(cost)) {
      const key = resource as keyof Resources
      this.resources[key] -= amount || 0
    }

    return true
  }

  add(delta: ResourceDelta): void {
    for (const [resource, amount] of Object.entries(delta)) {
      const key = resource as keyof Resources
      this.resources[key] += amount || 0
    }
  }

  getResources(): Readonly<Resources> {
    return { ...this.resources }
  }

  getProduction(): Readonly<ResourceDelta> {
    return { ...this.production }
  }

  getConsumption(): Readonly<ResourceDelta> {
    return { ...this.consumption }
  }

  getNetFlow(): ResourceDelta {
    const net: ResourceDelta = {}

    for (const key of RESOURCE_KEYS) {
      const produced = this.production[key] || 0
      const consumed = this.consumption[key] || 0
      net[key] = produced - consumed
    }

    return net
  }

  toJSON() {
    return {
      resources: this.resources,
      production: this.production,
      consumption: this.consumption,
    }
  }

  static fromJSON(data: {
    resources: Resources
    production: ResourceDelta
    consumption: ResourceDelta
  }): ResourceManager {
    const manager = new ResourceManager(data.resources)
    manager.production = data.production
    manager.consumption = data.consumption
    return manager
  }
}
