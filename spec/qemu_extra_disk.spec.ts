import {QemuVm as FreeBsdVm} from '../src/operating_systems/freebsd/qemu_vm'
import {
  Vm as NetBsdVm,
  MicrovmVm
} from '../src/operating_systems/netbsd/qemu_vm'
import {Vm as MidnightBsdVm} from '../src/operating_systems/midnightbsd/qemu_vm'
import {Vm as OmniOsVm} from '../src/operating_systems/omnios/qemu_vm'
import {QemuVm as OpenBsdVm} from '../src/operating_systems/openbsd/qemu_vm'
import * as arch from '../src/architectures/factory'
import {Kind} from '../src/architectures/kind'
import {Host} from '../src/host'
import * as os from '../src/operating_systems/kind'
import '../src/operating_systems/freebsd/freebsd'
import {Input} from '../src/action/input'

describe('QEMU extra disk attachment', () => {
  const host = Host.create('linux')
  const architecture = arch.create(
    Kind.x86_64,
    host,
    os.Kind.for('freebsd'),
    host.hypervisor
  )
  const input = new Input(host)
  beforeEach(() => {
    spyOnProperty(input, 'version', 'get').and.returnValue('7.9')
  })

  const config = {
    memory: '1G',
    cpuCount: 1,
    diskImage: 'root.raw',
    ssHostPort: 2847,
    cpu: 'host',
    machineType: 'q35',
    resourcesDiskImage: 'resources.raw',
    firmware: 'bios',
    kernel: 'kernel',
    microvmFirmware: 'qboot'
  }

  for (const [VmClass, device] of [
    [FreeBsdVm, 'virtio-blk-pci'],
    [MidnightBsdVm, 'virtio-blk-pci'],
    [NetBsdVm, 'scsi-hd'],
    [OpenBsdVm, 'scsi-hd'],
    [OmniOsVm, 'virtio-blk'],
    [MicrovmVm, 'virtio-blk-device']
  ] as const) {
    it(`attaches an additional ${device} disk for ${VmClass.name}`, () => {
      const command = new VmClass('', '', architecture, input, {
        ...config,
        extraDiskImage: '/tmp/extra disk.raw'
      }).command
      expect(command).toContain(`${device},drive=drive2`)
      expect(command).toContain(
        'if=none,file=/tmp/extra disk.raw,id=drive2,cache=unsafe,discard=ignore,format=raw'
      )
      expect(command.filter(value => value.includes('drive2')).length).toEqual(
        2
      )
      if (VmClass === MicrovmVm) {
        expect(command.join(' ')).not.toContain('pci')
      }
    })

    it(`preserves the command without an extra ${device} disk for ${VmClass.name}`, () => {
      const command = new VmClass('', '', architecture, input, config).command
      expect(command.join(' ')).not.toContain('drive2')
    })
  }

  it('escapes commas in the image path', () => {
    const command = new FreeBsdVm('', '', architecture, input, {
      ...config,
      extraDiskImage: '/tmp/extra,disk.raw'
    }).command
    expect(command.join(' ')).toContain('file=/tmp/extra,,disk.raw,id=drive2')
  })
})
