#!/bin/sh

echo "Preparing..."
cd /home/node/app
chown -R node:node .

echo "Building..."
npm install

#wget https://archive.org/download/Oregon_Trail_Disk_1_of_2/Oregon_Trail_Disk_1_of_2.dsk
#./bin/dsk2json --name="Oregon Trail Disk 1" --category="Games" Oregon_Trail_Disk_1_of_2.dsk > json/disks/Oregon_Trail_Disk_1_of_2.json
#wget https://archive.org/download/Oregon_Trail_Disk_2_of_2/Oregon_Trail_Disk_2_of_2.dsk
#./bin/dsk2json --name="Oregon Trail Disk 2" --category="Games" Oregon_Trail_Disk_2_of_2.dsk > json/disks/Oregon_Trail_Disk_2_of_2.json
#./bin/index

echo "Starting server..."
npm start

