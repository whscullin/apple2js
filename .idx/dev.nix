{pkgs}: {

  # Which nixpkgs channel to use.
  channel = "stable-23.05"; # or "unstable"

  # Use https://search.nixos.org/packages to  find packages
  packages = [
    pkgs.nodejs_18
    pkgs.cacert 
    pkgs.openssh 
    pkgs.fakeroot
  ];

  # search for the extension on https://open-vsx.org/ and use "publisher.id"
  idx.extensions = [
    "ms-vscode.js-debug"
    "dbaeumer.vscode-eslint"
    "esbenp.prettier-vscode"
  ];

    idx.previews = {
    enable = true;
    previews = [
      {
        command = [
          "npm"
          "start"
          "--"
          "--port"
          "$PORT"
        ];
        manager = "web";
        id = "web";
      }
    ];
  };
}