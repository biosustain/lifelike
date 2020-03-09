import { Pipe, PipeTransform } from '@angular/core';

function formatDate(date_str) {const date = new Date(date_str);
  
  const monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

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
