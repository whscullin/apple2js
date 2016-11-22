#!/usr/bin/env perl -w
# Copyright 2010-2016 Will Scullin <scullin@scullinsteel.com>
# 
# Permission to use, copy, modify, distribute, and sell this software and its
# documentation for any purpose is hereby granted without fee, provided that
# the above copyright notice appear in all copies and that both that
# copyright notice and this permission notice appear in supporting
# documentation.  No representations are made about the suitability of this
# software for any purpose.  It is provided "as is" without express or
# implied warranty.

use MIME::Base64 qw(encode_base64);
use JSON qw(from_json);
use Data::Dumper;
use Getopt::Std;

my $disk;
my @disks = ();

my %opts;
getopts('pe', \%opts);

while (<json/disks/*.json>) {
    my $json;
    my $fn = $_;
    print STDERR "$fn\n";
    open(DISK, $fn) or die $!;
    while (<DISK>) {
	my $line = $_;
	
	$line =~ s/^loadJSON\(//;
	$line =~ s/\);$//;
	
	$json .= $line;
    }
    close(DISK);
    
    $disk = from_json($json);
    $disk->{'filename'} = $fn;
    $disk->{'data'} = NULL;

    push(@disks, $disk);
}

@disks = sort { $a->{'category'} . $a->{'name'} cmp $b->{'category'} . $b->{'name'} } @disks;

my $first = 1;
print "disk_index = [\n";
foreach $disk (@disks) {
    next if $disk->{'private'} && !$opts{'p'};
    next if $disk->{'2e'} && !$opts{'e'};

    print ",\n" unless ($first);
    print "  {\n";
    print "     \"filename\": \"" . $disk->{'filename'} . "\",\n";
    print "     \"name\": \"" . $disk->{'name'} . "\",\n";
    if ($disk->{'disk'}) {
	print "     \"disk\": \"" . $disk->{'disk'} . "\",\n";
    }
    print "     \"category\": \"" . $disk->{'category'} . "\"\n";
    print "  }";
    $first = 0;
}
print "\n];\n";
