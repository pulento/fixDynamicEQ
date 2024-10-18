# fixDynamicEQ for Mac

Simple packaging of OCA's fixDynamicEQ for MacOS

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
