// Native Windows helper. Builds with the installed .NET Framework C# compiler.
// Configures only a dedicated central queue; never changes the source queue.
using System;
using System.Globalization;
using System.ComponentModel;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

public static class MdvPrintPaper {
  [StructLayout(LayoutKind.Sequential)] struct PrinterInfo2 {
    public IntPtr server,name,share,port,driver,comment,location,mode,separator,processor,dataType,parameters,security;
    public uint attributes,priority,defaultPriority,startTime,untilTime,status,jobs,averagePpm;
  }
  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
  [DllImport("winspool.drv",SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetPrinter(IntPtr handle,uint level,IntPtr info,uint size,out uint needed);
  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr AddPrinter(string server,uint level,ref PrinterInfo2 info);
  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern int DocumentProperties(IntPtr window,IntPtr handle,string name,IntPtr output,IntPtr input,uint flags);
  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetPrinter(IntPtr handle,uint level,IntPtr data,uint command);
  static string Str(IntPtr ptr) { return ptr==IntPtr.Zero ? "" : Marshal.PtrToStringUni(ptr); }
  static IntPtr ReadPrinter(IntPtr handle) {
    uint needed; GetPrinter(handle,2,IntPtr.Zero,0,out needed);
    if(needed==0) throw new Win32Exception();
    IntPtr data=Marshal.AllocHGlobal((int)needed);
    if(!GetPrinter(handle,2,data,needed,out needed)) { Marshal.FreeHGlobal(data); throw new Win32Exception(); }
    return data;
  }
  static void Configure(string name,double width,double height,bool save) {
    IntPtr handle=IntPtr.Zero,buffer=IntPtr.Zero,info=IntPtr.Zero;
    try {
      if(!OpenPrinter(name,out handle,IntPtr.Zero)) throw new Win32Exception();
      int size=DocumentProperties(IntPtr.Zero,handle,name,IntPtr.Zero,IntPtr.Zero,0);
      if(size<220) throw new Exception("Driver nao forneceu DEVMODE Unicode valido.");
      buffer=Marshal.AllocHGlobal(size);
      if(DocumentProperties(IntPtr.Zero,handle,name,buffer,IntPtr.Zero,2)!=1) throw new Exception("Falha ao ler formato do driver.");
      // DEVMODEW public header offsets; preserve all private driver bytes.
      int fields=(Marshal.ReadInt32(buffer,72) & ~0x10000) | 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x100 | 0x1000;
      Marshal.WriteInt32(buffer,72,fields);
      Marshal.WriteInt16(buffer,76,1); // portrait; width/height come from PDF
      Marshal.WriteInt16(buffer,78,256); // DMPAPER_USER
      Marshal.WriteInt16(buffer,80,(short)Math.Round(height*10));
      Marshal.WriteInt16(buffer,82,(short)Math.Round(width*10));
      Marshal.WriteInt16(buffer,84,100); // scale
      Marshal.WriteInt16(buffer,86,1); // copies: PDF already has N pages
      Marshal.WriteInt16(buffer,94,1); // simplex
      if(DocumentProperties(IntPtr.Zero,handle,name,buffer,buffer,10)!=1) throw new Exception("Driver rejeitou o formato solicitado.");
      if(Math.Abs(Marshal.ReadInt16(buffer,80)/10.0-height)>0.15 || Math.Abs(Marshal.ReadInt16(buffer,82)/10.0-width)>0.15 || Marshal.ReadInt16(buffer,76)!=1 || Marshal.ReadInt16(buffer,86)!=1)
        throw new Exception("Driver alterou as configuracoes. Impressao interrompida para preservar o formato.");
      if(save) {
        info=Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(info,buffer);
        if(!SetPrinter(handle,9,info,0)) throw new Win32Exception();
      }
    } finally {
      if(info!=IntPtr.Zero) Marshal.FreeHGlobal(info);
      if(buffer!=IntPtr.Zero) Marshal.FreeHGlobal(buffer);
      if(handle!=IntPtr.Zero) ClosePrinter(handle);
    }
  }
  static string EnsureAlias(string source) {
    string suffix;
    using(var sha=SHA256.Create()) suffix=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(source))).Replace("-","").Substring(0,12);
    string alias="MDV Central "+suffix, comment="Mercado do Vale central: "+source;
    IntPtr original=IntPtr.Zero,existing=IntPtr.Zero,data=IntPtr.Zero,other=IntPtr.Zero,namePtr=IntPtr.Zero,commentPtr=IntPtr.Zero;
    try {
      if(!OpenPrinter(source,out original,IntPtr.Zero)) throw new Win32Exception();
      data=ReadPrinter(original);
      var info=(PrinterInfo2)Marshal.PtrToStructure(data,typeof(PrinterInfo2));
      if(OpenPrinter(alias,out existing,IntPtr.Zero)) {
        other=ReadPrinter(existing);
        var check=(PrinterInfo2)Marshal.PtrToStructure(other,typeof(PrinterInfo2));
        if(Str(check.port)!=Str(info.port) || Str(check.driver)!=Str(info.driver) || Str(check.comment)!=comment)
          throw new Exception("Fila central existente diverge da impressora de origem.");
        return alias;
      }
      namePtr=Marshal.StringToHGlobalUni(alias); commentPtr=Marshal.StringToHGlobalUni(comment);
      info.name=namePtr; info.comment=commentPtr; info.server=IntPtr.Zero; info.share=IntPtr.Zero; info.security=IntPtr.Zero;
      info.attributes=0x40; // local, not shared and not the Windows default
      IntPtr created=AddPrinter(null,2,ref info);
      if(created==IntPtr.Zero) throw new Win32Exception();
      ClosePrinter(created); return alias;
    } finally {
      if(namePtr!=IntPtr.Zero) Marshal.FreeHGlobal(namePtr);
      if(commentPtr!=IntPtr.Zero) Marshal.FreeHGlobal(commentPtr);
      if(other!=IntPtr.Zero) Marshal.FreeHGlobal(other);
      if(data!=IntPtr.Zero) Marshal.FreeHGlobal(data);
      if(existing!=IntPtr.Zero) ClosePrinter(existing);
      if(original!=IntPtr.Zero) ClosePrinter(original);
    }
  }
  public static int Main(string[] args) {
    try {
      if(args.Length<3 || args.Length>4) throw new Exception("Parametros invalidos.");
      string source=args[0]; double width=Double.Parse(args[1],CultureInfo.InvariantCulture),height=Double.Parse(args[2],CultureInfo.InvariantCulture);
      if(Double.IsNaN(width)||Double.IsNaN(height)||width<10||width>1000||height<10||height>2000) throw new Exception("Dimensoes invalidas.");
      Configure(source,width,height,false);
      if(args.Length==4) {
        if(args[3]!="probe") throw new Exception("Modo invalido.");
        Console.WriteLine("{\"accepted\":true}"); return 0;
      }
      string alias=EnsureAlias(source); Configure(alias,width,height,true);
      var settings=new PrinterSettings(); settings.PrinterName=alias;
      var paper=settings.DefaultPageSettings.PaperSize;
      if(Math.Abs(paper.Width*0.254-width)>0.3 || Math.Abs(paper.Height*0.254-height)>0.3)
        throw new Exception("Windows nao preservou o tamanho solicitado na fila central.");
      Console.WriteLine("{\"printer\":\""+alias+"\",\"widthMm\":"+width.ToString(CultureInfo.InvariantCulture)+",\"heightMm\":"+height.ToString(CultureInfo.InvariantCulture)+"}");
      return 0;
    } catch(Exception error) { Console.Error.WriteLine(error.Message); return 1; }
  }
}
