export function createCommandRegistry(context, canEdit) {
  const commands = new Map(),
    plugins = new Set()
  let disposed = false
  return {
    register(plugin) {
      if (
        disposed ||
        !plugin ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(plugin.id) ||
        plugins.has(plugin.id) ||
        !Array.isArray(plugin.commands)
      )
        throw new Error('Geçersiz veya yinelenen eklenti.')
      const draft = new Map()
      for (const command of plugin.commands) {
        const id = `${plugin.id}/${command.id}`
        if (
          !/^[a-z][a-z0-9-]{0,63}$/.test(command.id) ||
          draft.has(id) ||
          typeof command.title !== 'string' ||
          typeof command.execute !== 'function'
        )
          throw new Error('Geçersiz eklenti komutu.')
        draft.set(id, command)
      }
      plugins.add(plugin.id)
      for (const [id, command] of draft) commands.set(id, command)
      let active = true
      return () => {
        if (!active) return
        active = false
        for (const id of draft.keys()) commands.delete(id)
        plugins.delete(plugin.id)
      }
    },
    list() {
      return [...commands].map(([id, command]) => ({
        id,
        title: command.title,
        enabled: !disposed && canEdit() && (!command.enabled || !!command.enabled(context)),
      }))
    },
    execute(id, argument) {
      const command = commands.get(id)
      if (disposed || !canEdit() || !command || (command.enabled && !command.enabled(context)))
        return false
      command.execute(context, argument)
      return true
    },
    dispose() {
      disposed = true
      commands.clear()
      plugins.clear()
    },
  }
}
