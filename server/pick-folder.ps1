param([string]$InitialPath = "")
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SdvFolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7"), ClassInterface(ClassInterfaceType.None)]
  private class FileOpenDialogRCW { }
  [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IFileDialog {
    [PreserveSig] uint Show([In, Optional] IntPtr hwndOwner);
    void SetFileTypes(); void SetFileTypeIndex(); void GetFileTypeIndex();
    void Advise(); void Unadvise();
    void SetOptions(uint fos); void GetOptions(out uint fos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IShellItem ppsi);
    void AddPlace(IShellItem psi, int alignment);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(int hr);
    void SetClientGuid();
    void ClearClientData();
    void SetFilter([MarshalAs(UnmanagedType.IUnknown)] object pFilter);
  }
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IShellItem {
    void BindToHandler(); void GetParent();
    void GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(); void Compare();
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  private static extern IShellItem SHCreateItemFromParsingName(
    [MarshalAs(UnmanagedType.LPWStr)] string pszPath, IntPtr pbc, [In] ref Guid riid);
  public static string Pick(string initialPath, string title) {
    var dialog = (IFileDialog)new FileOpenDialogRCW();
    uint opts; dialog.GetOptions(out opts);
    // FOS_PICKFOLDERS (0x20) | FOS_FORCEFILESYSTEM (0x40) | FOS_NOCHANGEDIR (0x8)
    dialog.SetOptions(opts | 0x20 | 0x40 | 0x8);
    if (!string.IsNullOrEmpty(title)) dialog.SetTitle(title);
    if (!string.IsNullOrEmpty(initialPath)) {
      try {
        Guid itemGuid = typeof(IShellItem).GUID;
        var item = SHCreateItemFromParsingName(initialPath, IntPtr.Zero, ref itemGuid);
        if (item != null) dialog.SetFolder(item);
      } catch { }
    }
    uint hr = dialog.Show(IntPtr.Zero);
    if (hr != 0) return null;
    IShellItem result; dialog.GetResult(out result);
    IntPtr pathPtr;
    result.GetDisplayName(0x80058000u, out pathPtr);
    string path = Marshal.PtrToStringUni(pathPtr);
    Marshal.FreeCoTaskMem(pathPtr);
    return path;
  }
}
"@
$result = [SdvFolderPicker]::Pick($InitialPath, "Select folder for SDV")
if ($result) { [Console]::Out.WriteLine($result) }
