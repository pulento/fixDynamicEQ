# fixDynamicEQ for Mac, Windows and Linux

Simple packaging of OCA's fixDynamicEQ for MacOS, Windows and Linux

Please visit [OCA's YouTube video](https://www.youtube.com/watch?v=tNj-nWR-Yyo) that introduce A1 Evo Nexus

# Features vs original fixDynamicEQ

<ul>
  <li>You can force AVR IP using -f AVRIP</li>
  <li>For example ./fixDynamicEQ -f 192.168.0.155</li>
</ul>

# Install

Go to the [releases](https://github.com/pulento/fixDynamicEQ/releases) and download last one

# Install for Developers

Clone this repository:
```
git clone https://github.com/pulento/fixDynamicEQ.git
```
```
cd fixDynamicEQ
```

Install dependencies:

```
npm install
```

Run:

```
npm start
```

Package:

```
npm install -g pkg
````

For ARM64 Mac:

```
pkg . -t "node*-macos-arm64"
````

For x64 Mac:

```
pkg . -t "node*-macos-x64"
````

For x64 Windows:

```
pkg . -t "node*-win-x64"
````

For x64 Linux:

```
pkg . -t "node*-linux-x64"
````

# Run with a Process Manager

fixDynamicEQ sometimes exits when changes occurs on the network side of the hosting machine. To overcome this you can use a process
manager like [PM2](https://pm2.keymetrics.io/) to restart it in those cases.

If you don't have npm installed you can install it through [Homebrew](https://brew.sh) on MacOS or download NodeJS for Windows directly from its [site](https://nodejs.org/en/download/package-manager).

Then having npm in place you can install PM2:

```
npm install -g pm2
````

Then run fixDynamicEQ through PM2 like this:

````
pm2 start fixDynamicEQ
`````

Or like this if you want to force AVR's IP.

````
pm2 start fixDynamicEQ -- -f 192.168.0.155
`````

You can stop, check logs or monitor its execution if you want:

````
pm2 stop fixDynamicEQ
`````

````
pm2 logs
`````

````
pm2 monit
`````

A PM2 config file is included to ease execution especially on Windows where argument pass is a pain, edit it to suit your needs, check args variable if you need to remove it or change the IP of your AVR, then start with following command:

````
pm2 start deq_pm2.config.js
````

# Official A1 Evo Nexus forum thread

A1 Evo Nexus is discussed and released in the following [AVS Forum thread](https://www.avsforum.com/threads/nexus-next-gen-room-eq-by-oca.3309475).

# Important Notes

**MacOS packages aren't signed, MacOS probably will say it is damaged and should be deleted. Run the following from your terminal:**

```
chmod +x fixDynamicEQ
```

```
xattr -c ./fixDynamicEQ
```
