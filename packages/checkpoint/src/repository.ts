import Dexie, { type EntityTable } from 'dexie'
import {
  checkpointSchema,
  type LifeDesignCheckpoint,
} from '@life-design/core'

export class CheckpointRepository extends Dexie {
  checkpoints!: EntityTable<LifeDesignCheckpoint, 'sessionId'>

  constructor(name = 'life-design-studio') {
    super(name)
    this.version(1).stores({ checkpoints: 'sessionId, updatedAt, revision' })
  }

  async save(checkpoint: LifeDesignCheckpoint): Promise<void> {
    const valid = checkpointSchema.parse(checkpoint)
    await this.transaction('rw', this.checkpoints, async () => {
      const current = await this.checkpoints.get(valid.sessionId)
      if (current && current.revision >= valid.revision) {
        throw new Error('Stale checkpoint revision')
      }
      await this.checkpoints.put(valid)
    })
  }

  async load(sessionId: string): Promise<LifeDesignCheckpoint | null> {
    const value = await this.checkpoints.get(sessionId)
    return value ? checkpointSchema.parse(value) : null
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.checkpoints.delete(sessionId)
  }

  async deleteDatabase(): Promise<void> {
    this.close()
    await Dexie.delete(this.name)
  }
}
