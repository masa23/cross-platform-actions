import * as core from '@actions/core'
import * as fs from 'fs'

import {Action} from '../../src/action/action'
import {Input} from '../../src/action/input'
import {Host} from '../../src/host'
import {Vm} from '../../src/vm'
import {QemuVm} from '../../src/operating_systems/freebsd/qemu_vm'
import '../../src/operating_systems/freebsd/factory'

describe('the extra_disk_size input', () => {
  let values: Record<string, string>
  const read = () => new Input(Host.create('linux'))

  beforeEach(() => {
    values = {operating_system: 'freebsd', version: '13.0'}
    spyOn(core, 'getInput').and.callFake(name => values[name] ?? '')
  })

  it('adds no disk when omitted', () => {
    expect(read().extraDiskSize).toEqual(0)
  })

  it('rejects unsupported SIMH guests', () => {
    values['architecture'] = 'vax'
    values['extra_disk_size'] = '1G'
    expect(() => read().extraDiskSize).toThrowError(/not supported on VAX/)
  })

  it('includes the disk capacity in the VM reuse hash', () => {
    const absent = read().toHash()
    values['extra_disk_size'] = '1G'
    const one = read().toHash()
    values['extra_disk_size'] = '2G'
    expect(read().toHash()).not.toEqual(one)
    expect(one).not.toEqual(absent)
  })

  it('allows equivalent sizes when reusing a VM', () => {
    values['extra_disk_size'] = '1G'
    const hash = read().toHash()
    values['extra_disk_size'] = '1024m'
    expect(read().toHash()).toEqual(hash)
  })

  describe('preparing the VM', () => {
    let action: Action

    beforeEach(() => {
      values['extra_disk_size'] = '100G'
      action = new Action()
      spyOn(action.operatingSystem, 'prepareDisk').and.resolveTo()
    })

    afterEach(() => fs.rmSync(action.tempPath, {recursive: true, force: true}))

    it('creates and attaches the extra disk on the first invocation', async () => {
      spyOnProperty(Vm, 'isRunning', 'get').and.returnValue(false)
      await action['createRunPreparer']().prepareDisk('image', 'resources')
      expect(fs.statSync(action.extraDiskImage!).size).toEqual(100 * 1024 ** 3)

      const vm = action.creareVm('qemu', 'firmware', 'resources', {
        memory: '1G',
        cpuCount: 1
      }) as QemuVm
      expect(vm.command).toContain('virtio-blk-pci,drive=drive2')
      expect(vm.command.join(' ')).toContain(
        `file=${action.extraDiskImage},id=drive2`
      )
    })

    it('does not create or truncate a disk when reusing a running VM', async () => {
      spyOnProperty(Vm, 'isRunning', 'get').and.returnValue(true)
      fs.writeFileSync(action.extraDiskImage!, 'guest data')
      await action['createRunPreparer']().prepareDisk('', '')
      expect(fs.readFileSync(action.extraDiskImage!, 'utf8')).toEqual(
        'guest data'
      )
      expect(action.operatingSystem.prepareDisk).not.toHaveBeenCalled()
    })

    it('creates no extra disk when the input is omitted', async () => {
      values['extra_disk_size'] = ''
      spyOnProperty(Vm, 'isRunning', 'get').and.returnValue(false)
      await action['createRunPreparer']().prepareDisk('image', 'resources')
      expect(action.extraDiskImage).toBeUndefined()
      expect(fs.readdirSync(action.tempPath)).toEqual([])
    })
  })
})
