#!/usr/bin/env python3
"""Prepare five local, short Go-stone taps from a verified CC0 Freesound recording.

Original: GoStoneSounds.ogg by billhails2, Freesound #588317
License: Creative Commons Zero 1.0
https://freesound.org/people/billhails2/sounds/588317/
"""
import array, html, pathlib, re, subprocess, urllib.request, wave

PAGE="https://freesound.org/people/billhails2/sounds/588317/"
OUT=pathlib.Path("assets/audio")
OUT.mkdir(parents=True,exist_ok=True)

def urlread(url):
    request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (GoApp sound build; GitHub Actions)"})
    return urllib.request.urlopen(request,timeout=35).read()

markup=urlread(PAGE).decode("utf-8","replace")
pattern=r'<meta\b(?=[^>]*(?:property|name)=["\'](?:og:audio|twitter:player:stream)["\'])[^>]+>'
tags=re.findall(pattern,markup,flags=re.I)
preview=None
for tag in tags:
    m=re.search(r'content=["\']([^"\']+)["\']',tag,re.I)
    if m:
        candidate=html.unescape(m.group(1))
        if "cdn.freesound.org/previews/" in candidate and ".mp3" in candidate:
            preview=candidate.replace("-lq.mp3","-hq.ogg")
            break
if not preview:
    # Greasyfork script implementation documents an og:audio preview.
    matches=re.findall(r'https://cdn\.freesound\.org/previews/[^"\'\s<>]+?-lq\.mp3',markup)
    if matches: preview=html.unescape(matches[0]).replace("-lq.mp3","-hq.ogg")
if not preview:
    raise RuntimeError("No public Freesound CC0 preview URL was present; leaving existing SE intact")

data=urlread(preview)
if len(data)<3000:raise RuntimeError("Preview payload unexpectedly short")
raw=subprocess.run(
 ["ffmpeg","-hide_banner","-loglevel","error","-i","pipe:0",
  "-ar","32000","-ac","1","-f","s16le","pipe:1"],
 input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
arr=array.array("h")
arr.frombytes(raw)
sr=32000
window=320
rms=[]
for p in range(0,len(arr)-window,window):
    chunk=arr[p:p+window]
    rms.append((sum(v*v for v in chunk)/len(chunk))**.5)
# Find strong attack transients, at most one per .5 s (five recorded taps).
peaks=[]
threshold=max(rms)*.17
for i in range(2,len(rms)-2):
    if rms[i]<threshold or not (rms[i]>rms[i-1] and rms[i]>=rms[i+1]):
        continue
    peaks.append((rms[i],i))
peaks.sort(reverse=True)
chosen=[]
for volume,i in peaks:
    if all(abs(i-other)>48 for other in chosen):
        chosen.append(i)
        if len(chosen)==5:break
if len(chosen)<4:
    raise RuntimeError("Could not identify at least four isolated stone impact sounds")
chosen.sort()
# Include a short pre-attack, the snap and decay, then smoothly fade to silence.
for count,i in enumerate(chosen):
    p=max(0,int((i*.010-.023)*sr))
    q=min(len(arr),p+int(sr*.27))
    clip=array.array("h",arr[p:q])
    for j in range(min(1800,len(clip))):
        idx=len(clip)-1-j
        clip[idx]=int(clip[idx]*j/1800)
    dest=OUT/f"stone{count+1}.wav"
    with wave.open(str(dest),"wb") as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(sr)
        wav.writeframes(clip.tobytes())
    print("Prepared",dest,len(clip)/sr,"s from onset",round(i*.010,2),"s")
(OUT/"SOURCE.txt").write_text(
  "GoStoneSounds.ogg by billhails2 (2021-09-26)\\n"
  "CC0 1.0 Public Domain\\n"
  "https://freesound.org/people/billhails2/sounds/588317/\\n"
  "Contains shortened excerpts from 5 Go-stone recordings.\\n",encoding="utf-8")
