# 수다리 전역 입력 후크 (Windows)
#
# 표준출력으로 딱 두 가지만 흘린다:
#   K            키가 하나 눌렸다  (어떤 키인지는 읽지도, 내보내지도 않는다)
#   W<delta>     마우스 휠이 굴렀다
#
# 키 코드를 일부러 수집하지 않는 이유: 수달은 "타이핑 중"만 알면 되고,
# 그 이상을 읽으면 키로거가 된다.

$ErrorActionPreference = 'Stop'

Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class SudariHook {
    const int WH_KEYBOARD_LL = 13;
    const int WH_MOUSE_LL    = 14;
    const int WM_KEYDOWN     = 0x0100;
    const int WM_SYSKEYDOWN  = 0x0104;
    const int WM_MOUSEWHEEL  = 0x020A;

    delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
    static extern IntPtr GetModuleHandle(string name);

    [StructLayout(LayoutKind.Sequential)]
    struct MSLLHOOKSTRUCT {
        public int x; public int y;
        public uint mouseData; public uint flags; public uint time; public IntPtr extra;
    }

    static HookProc kbProc, msProc;   // GC 방지: 반드시 참조를 붙들고 있어야 한다
    static IntPtr kbHook, msHook;

    static IntPtr OnKey(int code, IntPtr w, IntPtr l) {
        if (code >= 0) {
            int msg = (int)w;
            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                Console.Out.Write("K\n");
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(kbHook, code, w, l);
    }

    static IntPtr OnMouse(int code, IntPtr w, IntPtr l) {
        if (code >= 0 && (int)w == WM_MOUSEWHEEL) {
            MSLLHOOKSTRUCT m = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(MSLLHOOKSTRUCT));
            short delta = (short)((m.mouseData >> 16) & 0xffff);
            Console.Out.Write("W" + delta + "\n");
            Console.Out.Flush();
        }
        return CallNextHookEx(msHook, code, w, l);
    }

    public static void Run() {
        IntPtr mod = GetModuleHandle(null);
        kbProc = new HookProc(OnKey);
        msProc = new HookProc(OnMouse);
        kbHook = SetWindowsHookEx(WH_KEYBOARD_LL, kbProc, mod, 0);
        msHook = SetWindowsHookEx(WH_MOUSE_LL, msProc, mod, 0);
        if (kbHook == IntPtr.Zero && msHook == IntPtr.Zero) {
            Console.Error.Write("SetWindowsHookEx failed: " + Marshal.GetLastWin32Error() + "\n");
            return;
        }
        Console.Out.Write("READY\n");
        Console.Out.Flush();
        Application.Run();                       // 후크 콜백을 받으려면 메시지 루프가 필요하다
        if (kbHook != IntPtr.Zero) UnhookWindowsHookEx(kbHook);
        if (msHook != IntPtr.Zero) UnhookWindowsHookEx(msHook);
    }
}
'@

[SudariHook]::Run()
