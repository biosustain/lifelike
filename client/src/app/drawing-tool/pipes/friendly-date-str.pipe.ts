import { Pipe, PipeTransform } from '@angular/core';

function formatDate(date_str) {
  var date = new Date(date_str);
  
  var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return monthNames[monthIndex] + ' ' + day +  ', ' + year;
}

@Pipe({
  name: 'friendlyDateStr'
})
export class FriendlyDateStrPipe implements PipeTransform {

  transform(value: any, ...args: any[]): any {
    return formatDate(value);
  }

}
